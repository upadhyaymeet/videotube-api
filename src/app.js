import cookieParser from 'cookie-parser'
import express from 'express'

const app = express()

app.use(cors(
    {
        origin:process.env.CORS_ORIGIN,
        Credentials:true
    }
))

app.use(express.json({limit:"16kb"}))
app.use(express.static("public"))
app.use(express.urlencoded({extended:true, limit:"16kb"}))
app.use(cookieParser())

import userRouter from "./routes/user.routes.js"

app.use("/api/v1/user", userRouter)

export {app}
