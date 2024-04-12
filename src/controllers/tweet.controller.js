import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const {content} = req.body

    if(!content){
        throw new ApiError(400, "Content is required")
    }

    const tweet = await Tweet.create({
        content, 
        owner:req.user?._id
    })

    if(!tweet){
        throw new ApiError(500, "Failed to create tweet please try again")
    }

    return res.status(200)
    .json(
        new ApiResponse(200, tweet, "Tweet created Successfully")
    )
})


const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { content } = req.body
    const { tweetId } = req.params

    if(!content){
        throw new ApiError(400, "Content is required")
    }

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid Tweet")
    }

    const tweet = Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(404, "tweet not found")
    }

    if(tweet?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "Only owner can edit their tweet")
    }

    const newTweet = await Tweet.findByIdAndUpdate(
        tweetId, 
        {
            $set:{
                content
            }
        },
        {
            new:true
        }
    )

    if(!newTweet){
        throw new ApiError(500, "Failed to edit tweet please try again")
    }

    return res.status(200)
    .json(
        new ApiResponse(200, newTweet, "Tweet Update successfully")
    )
})

const deleteTweet = asyncHandler(async (req, res) => {
   const {tweetId} = req.params
   
   if(!isValidObjectId(tweetId)){
    throw new ApiError(400, "Invalid tweet Id")
   } 

   const tweet = await Tweet.findById(tweetId)

   if(!tweet){
    throw new ApiError(404, "Tweet not found")
   }

   if(tweet?.owner.toString() !== req.user?._id.toString()){
    throw new ApiError(400, "only onwer can delete their tweet")
   }

   await Tweet.findByIdAndDelete(tweetId);

   return res
       .status(200)
       .json(new ApiResponse(200, {tweetId}, "Tweet deleted successfully"));
})

const getUserTweets = asyncHandler(async (req, res) => {
    /*
        1.get user id check wether is valid or not
        2.$match with owner field
        3.lookup from "users" collection _id field and "owner" is localFeild as "ownerDetails",
        4.then write a subpipeline
        5.project avatar and usename
        6.then on main pipeline
        7.lookup for likes collection tweet field and localField is _id,
        8.then write a subpipeline and add project and get likedBy
        9.then add fields on mainPipeline
        10.addFields, likecount, ownerDetails, isLiked
    */

    const {userId} = req.params

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "Invalid user id")
    }

    const tweets = Tweet.aggregate([
        {
            $match:{
                owner:new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"ownerDetails",
                pipeline:[
                    {
                        $project:{
                            username:1,
                            avatar:1
                        }
                    }
                ]
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"tweet",
                as:"likeDetails",
                pipeline:[
                    {
                        $project:{
                            likedBy:1
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                likesCount:{
                    $size:"$likeDetails"
                },
                ownerDetails:{
                    $first:"$ownerDetails"
                },
                isLiked:{
                    $cond:{
                        if:{$in:[req.user?._id, "$likeDetails.likedBy"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $sort:{
                createdAt:-1
            }
        },
        {
            $project:{
                content:1,
                ownerDetails:1,
                likesCount:1,
                createdAt:1,
                isLiked:1
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200, tweets, "tweet fetched successfully"
        )
    )
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}