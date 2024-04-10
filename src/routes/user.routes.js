import { Router } from "express";
import { deleteUser, getUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateAvatar, updateCoverImage, updatePassword } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)

//secure routes
router.route("/logout").post(verifyJwt ,logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/get-user").get(verifyJwt, getUser)
router.route("/update-account").patch(verifyJwt, updateAccountDetails)
router.route("/avatar").patch(verifyJwt, upload.single("avatar"), updateAvatar)
router.route("/cover-image").patch(verifyJwt, upload.single("coverImage"), updateCoverImage)
router.route("/password").patch(verifyJwt, updatePassword)
router.route("/delete").delete(verifyJwt, deleteUser)

router.route("/c/:username").get(verifyJwt, getUserChannelProfile)
router.route("/history").get(verifyJwt, getWatchHistory )

export default router