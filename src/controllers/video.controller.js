import mongoose, {isValidObjectId} from "mongoose"
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import {Like} from "../models/like.model.js"
import {Comment} from "../models/comment.model.js"

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

const getVideoById = asyncHandler(async(req, res)=>{
    const { videoId } = req.params

    //check video id is valid object id 
    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid VideoId")
    }

    //check user id is valid object id
    if(!isValidObjectId(req.user?._id)){
        throw new ApiError(400, "Invalid UserId")
    }

    const video = await Video.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"video",
                as:"likes"
            }
        },{
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner",
                pipeline:[
                    {
                        $lookup:{
                            from:"subscriptions",
                            localField:"_id",
                            foreignField:"channel",
                            as:"subscribers"
                        }
                    },
                    {
                        $addFields:{
                            subscriberCount:{
                                $size:"$subscribers"
                            },
                            isSubscribed:{
                                $cond:{
                                    if:{
                                        $in:[
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then:true,
                                    else:false
                                }
                            }
                        }
                    },
                    {
                        $project:{
                            username:1,
                            avatar:1,
                            subscriberCount:1,
                            isSubscribed:1
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                likesCount:{
                    $size:"$likes"
                },
                owner:{
                    $first:"$owner"
                },
                isLiked:{
                    $cond:{
                        if:{$in:[req.user?._id, "$likes.likedBy"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                videoFile:1,
                title:1,
                description:1,
                views:1,
                createdAt:1,
                duration:1,
                comments:1,
                likesCount:1,
                owner:1,
                isLiked:1
            }
        }
    ])

    if(!video){
        throw new ApiError(500, "failed to fetch video")
    }

    //increment views if video fetched successfully

    await Video.findByIdAndUpdate(videoId, {
        $inc:{
            views:1
        }
    })

    //add this video to user watch history
    await User.findByIdAndUpdate(req.user?._id,{
        $addToSet:{
            watchHistory: videoId
        }
    })

    return res.status(200)
    .json(
        new ApiResponse(200, video[0], "Video details fetched successfully")
    )

})

const updateVideoById = asyncHandler(async(req, res)=>{
    const {title, description} = req.body
    const {videoId} = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid Video Id")
    }

    if(!(title || description)){
        throw new ApiError(400, "title and description are required")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "Video Not Found")
    }

    if(video?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(
            400, 
            "You cannot edit this video"
        )
    }

    const thumbnailLocalPath = req.files?.path;

    if(!thumbnailLocalPath){
        throw new ApiError(400, "Thumbnail is required")
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if(!thumbnail){
        throw new ApiError(400, "thumbnail not found")
    }

    const updateVideo = await Video.findById(
        videoId, 
        {
            $set:{
                title, 
                description,
                thumbnail:thumbnail.url
            }
        },
        {
            new :true
        }
    )

    if(!updateVideo){
        throw new ApiError(500, "Failed to upload a video please try again")
    }
    
    return res.status(200)
    .json(new ApiResponse(200, updateVideo, "video Update successfully"))
})

const deleteVideo = asyncHandler(async(req, res)=>{
    const {videoId} = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid Video Id")
    }

    const video = await Video.findById(videoId)

    if(video?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "You cant delete this video as you are not the owner")
    }

    const videoDeleted  = await Video.findByIdAndDelete(video?._id)

    if(!videoDeleted){
        throw new ApiError(400, "Failed to delete video please try again")
    }

    // video likes deleted 
    await Like.deleteMany({
        video:videoId
    })

    await Comment.deleteMany({
        video:Video.Id
    })

    return res.status(200)
    .json(
        new ApiResponse(200, {}, "Video Deleted SuccessFully")
    )
})

const togglePublishStatus = asyncHandler(async(req, res)=>{
    const {videoId} = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid Video ID")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(400, "video Not Found")
    }

    if(video?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(404, "You cannot toggle pubish video you are not owner")
    }

    const togglePublishVideo = await Video.findByIdAndUpdate(
            videoId,
            {
                $set:{
                    isPublished: !video?.isPublished
                }
            },
            {
                new:true
            }
    )
    if(!togglePublishVideo){
        throw new ApiError(500, "Failed to toggle video publish status")
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            {isPublished: togglePublishVideo.isPublished},
            "Video publish toggled successfully"
        )
    )
})

export{
    publishAVideo,
    getVideoById,
    updateVideoById,
    deleteVideo,
    togglePublishStatus
}