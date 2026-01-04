import { Request, Response, NextFunction } from "express";
import express from "express";
import { middlewareLogResponses, middlewareMetricsInc } from "./middleware.js";
import { config } from "./config.js";
import { NotFoundError, BadRequestError, ForbiddenError, UnauthorizedError } from "./errors.js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { createUser, deleteUsers, getUserByEmail, updateToRed, updateUser } from "./db/queries/users.js";
import { NewUser, User, NewChirp, NewRefreshToken } from "./db/schema.js";
import { createChirp, deleteChirpByID, getAllChirps, getChirpByID, getAllChirpsOfAuthor, getAllChirpsSortBy } from "./db/queries/chirps.js";
import { hashPassword, checkPasswordHash, getBearerToken, makeJWT, validateJWT, makeRefreshToken, getAPIKey } from "./auth.js";
import { createRefreshToken, getRefreshToken, revokeToken } from "./db/queries/tokens.js";

const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

const app = express();

app.use(express.json(), middlewareLogResponses);
app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.get("/admin/metrics", handlerNoOfRequests);
app.get("/api/healthz", handlerReadiness);
app.get("/api/chirps", (req, res, next) => {
  Promise.resolve(handlerGetChirps(req, res)).catch(next);
})
app.get("/api/chirps/:chirpID", (req, res, next) => {
  Promise.resolve(handlerGetChirpByID(req, res)).catch(next);
})

app.delete("/api/chirps/:chirpID", (req, res, next) => {
  Promise.resolve(handlerDeleteChirpByID(req, res)).catch(next);
});

app.post("/admin/reset",  (req, res, next) => {
  Promise.resolve(handlerReset(req, res)).catch(next);
});

app.post("/api/login",  (req, res, next) => {
  Promise.resolve(handlerLogin(req, res)).catch(next);
});

app.post("/api/refresh",  (req, res, next) => {
  Promise.resolve(handlerRefresh(req, res)).catch(next);
});

app.post("/api/revoke",  (req, res, next) => {
  Promise.resolve(handlerRevoke(req, res)).catch(next);
});

app.post("/api/users", (req, res, next) => {
  Promise.resolve(handlerUsers(req, res)).catch(next);
});

app.put("/api/users", (req, res, next) => {
  Promise.resolve(handlerExistingUsers(req, res)).catch(next);
});

app.post("/api/chirps", (req, res, next) => {
  Promise.resolve(handlerChirps(req, res)).catch(next);
});

app.post("/api/polka/webhooks", (req, res, next) => {
  Promise.resolve(handlerWebhooks(req, res)).catch(next);
});

app.use(errorHandler);

app.listen(config.api.port, () => {
  console.log(`Server is running at http://localhost:${config.api.port}`);
});

async function handlerReadiness(req: Request, res: Response): Promise<void> {
    res.set('Content-Type', 'text/plain').send("OK");
}   
async function handlerNoOfRequests(req: Request, res: Response): Promise<void> {
    const textToSend = metricsHTML.replace("{{NUM}}", config.api.fileServerHits.toString());
    res.set('Content-Type', 'text/html').send(textToSend);
}   

async function handlerReset(req: Request, res: Response): Promise<void> {
  if (config.api.platform !== "dev") {
    console.log(config.api.platform);
    throw new ForbiddenError("Reset is only allowed in dev environment.");
  }
    await deleteUsers();
    config.api.fileServerHits = 0;
    res.write("Hits reset to 0");
    res.end();
}  

async function handlerUsers(req: Request, res: Response) {

  let newUser: NewUser = req.body;
  if (!newUser.email) {
    throw new BadRequestError("No email found in body");
  }
  if (!newUser.password) {
    throw new BadRequestError("Password missing");
  }

  newUser.password = await hashPassword(newUser.password);

  const resp = await createUser(newUser);

    res.status(201).send({ id: resp.id, createdAt: resp.createdAt, updatedAt: resp.createdAt, email: resp.email, isChirpyRed: resp.isChirpyRed});
}

async function handlerExistingUsers(req: Request, res: Response) {

  const token = getBearerToken(req);

  const userId = validateJWT(token, config.api.secret);

  let newUser: NewUser = req.body;
  if (!newUser.email) {
    throw new BadRequestError("No email found in body");
  }
  if (!newUser.password) {
    throw new BadRequestError("Password missing");
  }

  newUser.password = await hashPassword(newUser.password);

  const resp = await updateUser(newUser, userId);

  res.status(200).send({ id: resp.id, createdAt: resp.createdAt, updatedAt: resp.createdAt, email: resp.email, isChirpyRed: resp.isChirpyRed});

}

async function handlerWebhooks(req: Request, res: Response) {

    const apikey = getAPIKey(req);

    if (apikey !== config.api.polkaKey) {
      throw new UnauthorizedError("Unauthorized");
    }

    type parameters = {
      event: string;
      data: { userId: string };
    }

    let input: parameters = req.body;

    if (!input) {
      throw new BadRequestError("Bad Request");
    }

    if (input.event !== "user.upgraded") {
      res.status(204).send();
      return;
    }

    const resp = await updateToRed(input.data.userId);

    if (!resp) {
      throw new NotFoundError("User Not Found");
    }

    res.status(204).send();
}

async function handlerLogin(req: Request, res: Response) {

    type parameters = {
      email: string;
      password: string;
      expiresInSeconds: number;
    }

    let newUser: parameters = req.body;
    if (!newUser.email) {
      throw new BadRequestError("No email found in body");
    }
    if (!newUser.password) {
      throw new BadRequestError("Password missing");
    }
    if (!newUser.expiresInSeconds) {
      newUser.expiresInSeconds = 3600;
    } else {
      if (newUser.expiresInSeconds > 3600) {
        newUser.expiresInSeconds = 3600;
      }
    }

    const user = await getUserByEmail(newUser.email);

    if (!user) {
      throw new UnauthorizedError("Unauthorized");
    }

    const passMatch = await checkPasswordHash(newUser.password, user.password);

    if (!passMatch) {
      throw new UnauthorizedError("Unauthorized");
    }

    let expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 60);

    const newRefreshToken: NewRefreshToken = {token: makeRefreshToken(), userId: user.id, expiresAt: expireDate};
    const refreshToken = await createRefreshToken(newRefreshToken);

    if (!refreshToken) {
      throw new Error("Could not create Refresh Token");
    }

    res.status(200).send({ id: user.id, createdAt: user.createdAt, updatedAt: user.updatedAt, email: user.email, isChirpyRed: user.isChirpyRed, token: makeJWT(user.id, newUser.expiresInSeconds, config.api.secret), refreshToken: refreshToken.token });

}

async function handlerGetChirpByID(req: Request, res: Response) {
  const chirpId = req.params.chirpID;

  const resp = await getChirpByID(chirpId);

    if (!resp) {
      throw new NotFoundError("Could not find chirp with provided id");
    }

    res.status(200).send(resp);
}

async function handlerDeleteChirpByID(req: Request, res: Response) {
  const chirpId = req.params.chirpID;

  const token = getBearerToken(req);

  const userId = validateJWT(token, config.api.secret);

  const resp = await getChirpByID(chirpId);
  if (!resp) {
    throw new NotFoundError("Chirp Not Found");
  }

  if (resp.userId !== userId) {
    throw new ForbiddenError("Forbidden");
  }

  const deleteResp = await deleteChirpByID(chirpId);

  if (!deleteResp) {
    throw new NotFoundError("Chirp Not Found");
  }

  res.status(204).send();

}

async function handlerGetChirps(req: Request, res: Response) {

    let authorId = "";
    let authorIdQuery = req.query.authorId;
    if (typeof authorIdQuery === "string") {
      authorId = authorIdQuery;
    }

    let sortMethod = "";
    let sortMethodQuery = req.query.sort;
    if (typeof sortMethodQuery === "string") {
      sortMethod = sortMethodQuery;
    }

    let resp;
    if (authorId !== "") {
      resp = await getAllChirpsOfAuthor(authorId);
    } else if (sortMethod !== "") {
      resp = await getAllChirpsSortBy(sortMethod);
    } else {
      resp = await getAllChirps();
    }

    if (!resp) {
      throw new Error("Could not get chirps");
    }

    res.status(200).send(resp);
}

async function handlerRefresh(req: Request, res: Response) {

    const token = getBearerToken(req);

    const refreshToken = await getRefreshToken(token);

    if (!refreshToken) {
      throw new UnauthorizedError("Unauthorized");
    } else if (refreshToken.expiresAt < new Date() || refreshToken.revokedAt !== null) {
      throw new UnauthorizedError("Invalid token");
    }

    res.status(200).send({ token: makeJWT(refreshToken.userId, 3600, config.api.secret) });

}

async function handlerRevoke(req: Request, res: Response) {
    
  const token = getBearerToken(req);

    const refreshToken = await getRefreshToken(token);

    if (!refreshToken) {
      throw new UnauthorizedError("Unauthorized");
    } else if (refreshToken.expiresAt < new Date() || !refreshToken.expiresAt) {
      throw new UnauthorizedError("Invalid token");
    }

    const revokeStatus = await revokeToken(token);

    if (!revokeStatus) {
      throw new Error("Could not revoke");
    }

    res.status(204).send();
}

async function handlerChirps(req: Request, res: Response) {

    type parameters = {
      body: string;
      userId: string;
    }

    const token = getBearerToken(req);

    const userId = validateJWT(token, config.api.secret);

    const params: parameters = req.body;

    if (!params.body) {
      throw new BadRequestError("Body is missing");
    }

    if (params.body.length > 140) {
        throw new BadRequestError("Chirp is too long. Max length is 140");
    } 

    const words = params.body.split(" ");
    for (let i = 0; i < words.length; i++) {
        let word: string = words[i];
        word = word.toLocaleLowerCase().replace("kerfuffle", "****").replace("sharbert", "****").replace("fornax", "****");
        if (word === "****") {
            words[i] = "****";
        }   
    }
    const cleanedBody = words.join(" ");

    const newChirp: NewChirp = { body: cleanedBody, userId: userId};
    const resp = await createChirp(newChirp);

    if (!resp) {
      throw new Error("Could not create chirp");
    }

    res.status(201).send(resp);

}

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof NotFoundError) {
    res.status(404).send({ error: err.message});
  } else if (err instanceof BadRequestError) {
    res.status(400).send({ error: err.message});
} else if (err instanceof UnauthorizedError) {
    res.status(401).send({ error: err.message});
} else if (err instanceof ForbiddenError) {
    res.status(403).send({ error: err.message});
  } else {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
}

const metricsHTML = `<html>                    
                        <body>
                            <h1>Welcome, Chirpy Admin</h1>
                            <p>Chirpy has been visited {{NUM}} times!</p>
                        </body>
                    </html>`