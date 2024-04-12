import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/AsyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
   /*
    1.check videoId is valid or not and get video id for req.params
    2.check wether is already liked or not
    3.if already liked then delete 
    4.if not like then create
   */
    const {videoId} = req.params
    
    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "VideoId is not a valid")
    }

    const isLiked = await Like.findOne(
        {
            video:videoId,
            likedBy:req.user?._id
        }
    )

    if(isLiked){
        await Like.findByIdAndDelete(isLiked?._id)

        return res.status(200).json(
            new ApiResponse(200, {isLiked:false})
        )
    }

    await Like.create({
        video:videoId,
        likedBy:req.user?._id
    })

    return res.status(200)
    .json(
        new ApiResponse(200, {isLiked:true})
    )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    
    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Comment id is not valid")
    }

    const isLiked = await Like.findOne({
        comment:commentId,
        likedBy:req.user?._id
    })

    if(isLiked){
        await Like.findByIdAndDelete(isLiked?._id)

        return res.status(200).json(
            new ApiResponse(200, {isLiked:false})
        )
    }

    await Like.create({
        comment:commentId,
        likedBy:req.user?._id
    })

    return res.status(200)
    .json(
        new ApiResponse(200, {isLiked:true})
    )

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    
    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Tweet Id not found")
    }

    const isLiked = await Like.findOne({
        tweet:tweetId,
        likedBy:req.user?._id
    })

    if(isLiked){
        await Like.findByIdAndDelete(isLiked?._id)

        return res.status(200).json(
            new ApiResponse(200, {isLiked:false})
        )
    }


    await Like.create({
        tweet:tweetId,
        likedBy:req.user?._id
    })

    return res.status(200)
    .json(
        new ApiResponse(200, {isLiked:true})
    )
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    /*
        1.$match with user id in LikedBy
        2.$lookup: from "videos" collection "_id", and localField:"video" as "likedVideos"
        3.write further pipeline to get details of user or video owner details
        4.$lookup from "user" collection _id and localField:owner in videos collection as "owner details"
        5.unwind in subpipeline $owner details
        6.after that in original pipeline unwid likedVideos
        7.sort
        8.project details of video owner details etc

    */

    const likedVideosAggregate = await Like.aggregate([
        {
            $match:{
                likedBy: new mongoose.Types.ObjectId(req.user?._id)
            },
        },
            {
                $lookup:{
                    from:"videos",
                    localField:"video",
                    foreignField:"_id",
                    as:"likedVideo",
                    pipeline:[
                        {
                            $lookup:{
                                from:"users",
                                localField:"owner",
                                foreignField:"_id",
                                as:"ownerDetails"
                            }
                        },
                        {
                            $unwind:"$ownerDetails"
                        }
                    ]
                }
            }
        ,{
            $unwind:"$likedVideo"
        },
        {
            $sort:{
                createdAt:-1
            }
        },
        {
            $project:{
                _id:0,
                likedVideo:{
                    _id:1,
                    videoFile:1,
                    thumbnail:1,
                    owner:1,
                    title:1,
                    description:1,
                    views:1,
                    duration:1,
                    createdAt:1,
                    isPublished:1,
                    ownerDetails:{
                        username:1,
                        fullName:1,
                        avatar:1
                    }

                }
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse(200, likedVideosAggregate, "liked videos fetched Successfully"))

})


export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}