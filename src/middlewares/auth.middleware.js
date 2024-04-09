import jwt from "jsonwebtoken"
import { asyncHandler } from "../utils/AsyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"

const verifyJwt = asyncHandler(async(req, res, next)=>{
    //get access token from cookies
    //check token value
    //decode token
    //find user with decodetoken id
    //send user with req.user

    try {
        const token = req.cookies?.accessToken
        if(!token){
            throw ApiError(401, "Unauthorized request")
        }

        const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY)

        const user = await User.findById(decodeToken?._id).select("-password -refreshToken")

        if(!user){
            throw new ApiError(401, "Invalid Access Token")
        }

        req.user = user
        next()
        
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access Token")
    }
})

export {verifyJwt}