import mongoose, { connect } from "mongoose"
import { asyncHandler } from "../utils/AsyncHandler.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js"
import { Video } from "../models/video.model.js"
import { Like } from "../models/like.model.js"
import { Comment } from "../models/comment.model.js"

const getVideoComments = asyncHandler(async(req, res)=>{
     /*
        1.find video by VideoId in video collection
        2.aggregate pipeline for comments
        3.$match videoId with videoField
        4.$lookup from user collection _id, with owner field of comment collection as "owner"
        5.$lookup from likes collection comment field with _id field of comment collection as "likes"
        6.addFields likescount and count like on commnent / owner: with first owner among group
        7.check wether is liked or not 
        8.then sorted latest
        9.then project content, createAt, likescount, owner:, isLiked
    */
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    const video = await Video.findById(videoId)
    
    if(!video){
        throw new ApiError(404, "Video not found")
    }

    const commentsAggregate =  Comment.aggregate([
        {
            $match:new mongoose.Types.ObjectId(videoId)
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner"
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"comment",
                as:"likes"
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
            $sort:{
                createdAt:-1
            }
        },
        {
            $project:{
                content:1,
                createdAt:1,
                likesCount:1,
                isLiked:1,
                owner:{
                    username:1,
                    fullName:1,
                    avatar:1
                }
            }
        }
    ])

    const options = {
        page:parseInt(page, 10),
        limit:parseInt(limit, 10)
    }

    const comments = await Comment.aggregatePaginate(
        commentsAggregate,
        options
    )

    return res.status(200)
    .json(
        new ApiResponse(200, comments, "Comments fetched successfully")
    )
   
})

const addComment = asyncHandler(async(req, res)=>{
    const {videoId} = req.params
    const {content} = req.body

    if(!content){
        throw new ApiError(400, "Content is required")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "video not found")
    }

    const comment = await Comment.create({
        content,
        owner:req.user?._id,
        video:videoId
    })

    if(!comment){
        throw new ApiError(500, "Failed to add comment please try again letter")
    }

    return res.status(201)
    .json(
        new ApiResponse(201, comment, "Comment Added Successfully")
    )


})

const updateComment = asyncHandler(async(req, res)=>{
    /*
        1.get comment id from the params
        2.get content from the body
        3.then compare comment.owner with req.owner to check authorized person
        4.update a comment 
    */

    const {commentId} = req.params
    const {content} = req.body

    if(!content){
        throw new ApiError(400, "Content is required")
    }

    const comment = await Comment.findById(commentId)
    if(comment?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "Only owner edit their comment")
    }

    const updateComment = await Comment.findByIdAndUpdate(
        comment?._id,
        {
            $set:{
                content
            }
        },
        {
            new:true
        }
    )

    if(!updateComment){
        throw new ApiError(500, "Failed to edit a comment try again")
    }

    return res.status(200)
    .json(
        new ApiResponse(200, updateComment, "Comment edit successfully")
    )

})

const deleteComment = asyncHandler(async(req, res)=>{
    /*
    1.get commment id from req.params
    2.check wether the owner and user are same or not
    3.find and delete
    4.then delete likes and comments to
    */

    const {commentId} = req.params

    const comment = await Comment.findById(commentId)
    
    if(!comment){
        throw new ApiError(404, "Comment not found")
    }

    if(comment?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "Only comment owner can delete their comment")
    }

    await Comment.findByIdAndDelete(
        commentId
    )

    await Like.deleteMany({
        comment:commentId,
        likedBy:req.user
    })

    return res.status(200)
    .json(
        new ApiResponse(200, {commentId}, "Comment deleted SUCCESSFULLY")
    )

})




export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}