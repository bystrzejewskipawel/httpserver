import { NextFunction, Request, Response } from "express";
import express from "express";
import { config } from "./config.js"

export function middlewareLogResponses(req: Request, res: Response, next: NextFunction) {
    res.on("finish", () => {
        const statusCode = res.statusCode;
        if (statusCode !== 200 && statusCode !== 201 && statusCode !== 204) {
            console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${statusCode}`);
        }
    });
    next();
}

export function middlewareMetricsInc(req: Request, res: Response, next: NextFunction) {
  config.api.fileServerHits++;
  next();
}