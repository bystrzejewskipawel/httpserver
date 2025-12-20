import { Request, Response, NextFunction } from "express";
import express from "express";
import { middlewareLogResponses, middlewareMetricsInc } from "./middleware.js";
import { config } from "./config.js";
import { NotFoundError, BadRequestError, ForbiddenError, UnauthorizedError } from "./errors.js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { createUser, deleteUsers } from "./db/queries/users.js";
import { NewUser, User, NewChirp } from "./db/schema.js";
import { createChirp, getAllChirps, getChirpByID } from "./db/queries/chirps.js";

const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

const app = express();

app.use(express.json(), middlewareLogResponses);
app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.get("/admin/metrics", handlerNoOfRequests);
app.get("/api/healthz", handlerReadiness);
app.get("/api/chirps", handlerGetChirps)
app.get("/api/chirps/:chirpID", handlerGetChirpByID)

app.post("/admin/reset", handlerReset);

app.post("/api/users", (req, res, next) => {
  Promise.resolve(handlerUsers(req, res)).catch(next);
});
app.post("/api/chirps", (req, res, next) => {
  Promise.resolve(handlerChirps(req, res)).catch(next);
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
  // type User = {
  //   email: string;
  // }

  let newUser: NewUser = { email: "" };
  try {
     newUser = req.body;
  } catch (error) {
    throw new BadRequestError("No email found in body");
  }

  const resp = await createUser(newUser);

  res.status(201).send(resp);
}

async function handlerGetChirpByID(req: Request, res: Response) {
  const chirpId = req.params.chirpID;

  const resp = await getChirpByID(chirpId);

    if (!resp) {
      throw new NotFoundError("Could not find chirp with provided id");
    }

    res.status(200).send(resp);
}

async function handlerGetChirps(req: Request, res: Response) {
    const resp = await getAllChirps();

    if (!resp) {
      throw new Error("Could not get chirps");
    }

    res.status(200).send(resp);
}

async function handlerChirps(req: Request, res: Response) {

    type parameters = {
      body: string;
      userId: string;
    }

    const params: parameters = req.body;

    if (!params.body) {
      throw new BadRequestError("Body is missing");
    }

     if (!params.userId) {
      throw new BadRequestError("User ID is missing");
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

    const newChirp: NewChirp = { body: cleanedBody, userId: params.userId};
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