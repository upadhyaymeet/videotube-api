import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"

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

// todo 
// logout, functionality , update account details, getuser , create middlware etc 

export {
    registerUser,
    loginUser,
    logoutUser
}
