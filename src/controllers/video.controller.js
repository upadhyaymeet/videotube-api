import mongoose, {isValidObjectId} from "mongoose"
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const publishAVideo = asyncHandler(async(req, res)=>{
    //description and title from body
    const {title, description} = req.body
    
    if([title, description].some((field)=>field?.trim() === "")){
        throw new ApiError(400, "All fields are required")
    }


    let videoLocalFilePath;
    let thumbnailLocalFilePath

    if(req.files && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0){
        videoLocalFilePath = req.files.videoFile[0].path
    }

    if(req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0){
        thumbnailLocalFilePath = req.files.thumbnail[0].path
    }

    if(!videoLocalFilePath){
        throw new ApiError(400, "Video files are required")
    }

    if(!thumbnailLocalFilePath){
        throw new ApiError(400, "Thumbnail are required")
    }

    const videoFile = await uploadOnCloudinary(videoLocalFilePath)
    const thumbnailFile = await uploadOnCloudinary(thumbnailLocalFilePath)

    if(!videoFile){
        throw new ApiError(400, "video files are required")
    }

    if(!thumbnailFile){
        throw new ApiError(400, "thumbnail files are required")
    }

    const video = await Video.create(
        {
            title,
            description,
            videoFile:videoFile.url,
            thumbnail:thumbnailFile.url,
            duration:videoFile.duration,
            owner:req.user._id,
            isPublished:false
        }
    )

    const videoUploaded = await Video.findById(video._id)

    if(!videoUploaded){   
        throw new ApiError(500, "VideoUploaded failed please try again")
    }

    
    return res.status(200)
    .json(
        new ApiResponse(200, video, "Video Uploaded Successfully")
    )
})





export{
    publishAVideo
}