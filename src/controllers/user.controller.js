import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async(userId)=>{
   try {
     const user = await User.findById(userId)
     const accessToken = user.generateAccessToken()
     const refreshToken = user.generateRefreshToken()
     
 
     user.refreshToken = refreshToken
     await user.save({validateBeforeSave:false})

     return {refreshToken, accessToken}
   } catch (error) {
    
        throw new ApiError(500, "Something went wrong while generating tokens")
   }
}

const registerUser = asyncHandler(async(req, res)=>{
    //get user details
    //check user fields is empty
    //check user is existed with email or username
    //upload file from multer middleware
    //upload file on cloudinary
    //create user
    //check whether user is created or not
    const {fullName, username, email, password} = req.body

   if(
    [fullName, username, email, password].some((field)=> field?.trim() === "")
   ){
    throw new ApiError(400, "All Fields are required")
   }

   const existedUser = await User.findOne(
    {
        $or:[{username}, {email}]
    }
   )

   if(existedUser){
    throw new ApiError(409, "User with email or username already exist")
   }

   let avatarLocalFilePath;
   let coverImageLocalFilePath;

   if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0){
    avatarLocalFilePath = req.files.avatar[0].path
   }

   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
    coverImageLocalFilePath = req.files.coverImage[0].path
   }

   if(!avatarLocalFilePath){
    throw new ApiError(400, "Avatar file is required")
   }

   const avatar = await uploadOnCloudinary(avatarLocalFilePath)
   const coverImage = await uploadOnCloudinary(coverImageLocalFilePath)

   if(!avatar){
    throw new ApiError(400, "Avatar file is required")
   }

   const user = await User.create(
    {
        fullName,
        username,
        email,
        password,
        avatar:avatar.url,
        coverImage:coverImage | "",
    }
   )

   const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
   )

   if(!createdUser){
    throw new ApiError(500, "Something went wrong while registering the user")
   }

   return res.status(200)
   .json(
    new ApiResponse(200, createdUser, "User Registered Successfully")
   )
   
})

const loginUser = asyncHandler(async(req, res)=>{
    // get username/email and password from user
    // check username/email
    // check password with isPasswordCorrect
    // generate accessToken and refresh Token
    // send accessToken and refreshToken in cookie
    const {username, email, password} = req.body
    
    if(!(username || email)){
        throw new ApiError(400, "Username or email required")
    }

    const user = await User.findOne(
        {
            $or:[
                {username} , {email}
            ]
        }
    )

    if(!user){
        throw new ApiError(400, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid Credentials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)
    
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,{
                user:loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res)=>{
    //get user from req.user
    //clear cookies
    //remove refreshToken with unset operator

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1 //this remove fields from document
            }
        },
        {
            new:true
        }
    )
 
    const options = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged Out")
    )

})

const refreshAccessToken = asyncHandler(async(req, res)=>{
    //get refreshtoken from req.cookies
    //check wether incoming token is or not
    //decode token using jwt verify
    //find the user with decode token
    //match user.refresh token with incoming refresh token
    //generate another token

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unathorized request")
    }

    const decodeToken = jwt.verify(
        incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET_KEY
    )
    const user = await User.findById(decodeToken?._id)

    if(!user){
        throw new ApiError(401, "Invalid refreshToken")
    }

    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "Refresh Token is expired or used")
    }

    const options = {
        httpOnly:true,
        secure:true
    }

    const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options )
    .json(
        new ApiResponse(200, 
            {accessToken, 
            refreshToken:newRefreshToken
            }, 
            "Access Token refreshed")
    )

})

const getUser = asyncHandler(async(req, res)=>{
    //get user id from req.user
    // select password and resfresh token

   const user =  await User.findById(req.user?._id).select("-password -refreshToken")

   return res.status(200).
   json(
    new ApiResponse(200, user, "User data fetched Successfully")
   )
})

const updateAccountDetails = asyncHandler(async(req, res)=>{
    //get data from : req.body
    //check data field
    //query update from User database
    const { username, fullName, email} = req.body

    if(!(username || email)){
        throw new ApiError(400, "Username or email is required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                username,
                fullName,
                email
            }
        },
        {
            new:true
        }
    ).select("-password -refresh")

    return res.status(200)
    .json(
        new ApiResponse(200, user, "Account details update successfully")
    )
})

const updatePassword = asyncHandler(async(req, res)=>{
    //old and new password from user : req.body
    //compare old password with existing password
    //then update new password

    const {oldPassword, newPassword, confirmPassword} = req.body
    
    const user = await User.findById(req.user?._id)

    const validPassword = user.isPasswordCorrect(oldPassword)
    if(!validPassword){
        throw new ApiError("Old Password does not match with exisiting password")
    }

    if(newPassword !== confirmPassword){
        throw new ApiError("New Password and confirm password does not match")
    }

    const changePassword = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                password:newPassword
            }
        }
    ).select("-password -refreshToken")

    return res.status(200)
    .json(
        new ApiResponse(200, changePassword, "Password change Successfully")
    )    
})

const updateAvatar = asyncHandler(async(req, res)=>{
    //check avtar is upload in multer or not
    //then upload on cloudinary
    //check wether file is uploaded or not on cloudinary
    const avatarLocalFilePath = req.file

    if(!avatarLocalFilePath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalFilePath)
    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new:true
        }
    ).select("-password -refreshToken")

    if(!user){
        throw new ApiError(500, "Something went wrong on server while uploading avatar")
    }

    return res.status(200)
    .json(
        new ApiResponse(200, user, "Avatar update successfully")
    )
})

const updateCoverImage = asyncHandler(async(req,res)=>{
    //get image from multer
    //check localcoverImageFile
    //upload on Cloudinairy
    //check file uploaded on cloudinary or not
    //update in database

    const coverImageLocalFilePath = req.file

    if(!coverImageLocalFilePath){
        throw new ApiError(400, "Cover Image File is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalFilePath)

    if(!coverImage){
        throw new ApiError(400, "Cover Image file is required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        }
    ).select("-password -refreshToken")

    return res.status(200)
    .json(
        new ApiResponse(200, user, "cover image update successfully")
    )
})

const deleteUser = asyncHandler(async(req, res)=>{
    //username and password -> req.body 
    //verify password and username
    //delete user from database

    const {email, password} = req.body

    const user = await User.findById(req.user?._id)
    
    if(email !== user.email){
        throw new ApiError(400, "Email Does not match")
    }

    const validPassword = user.isPasswordCorrect(password)

    if(!validPassword){
        throw new ApiError(400, "Invalid credentials")
    }

    const userDelete = await User.findByIdAndDelete(
        req.user?._id
    )

    return res.status(200)
    .json(
        new ApiResponse(200, {}, "User deleted Successfully")
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getUser,
    updateAccountDetails,
    updatePassword,
    updateAvatar,
    updateCoverImage,
    deleteUser
}
