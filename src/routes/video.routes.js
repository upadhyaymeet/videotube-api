import { Router } from "express";
import { publishAVideo } from "../controllers/video.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import {verifyJwt} from "../middlewares/auth.middleware.js"

const router = Router()
router.use(verifyJwt)

router.route("/").post(
    verifyJwt, 
    upload.fields([
        {
            name:"videoFile",
            maxCount:1
        },
        {
            name:"thumbnail",
            maxCount:1
        }
    ]),
    publishAVideo
)

export default router