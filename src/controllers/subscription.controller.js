import mongoose, {isValidObjectId} from "mongoose"
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import {Subscription} from "../models/subscription.model.js"

const toggleSubscription = asyncHandler(async(req, res)=>{
    /*
    1.first find subscriber with req.user.id and channelId from req.params
    2.then findOne isSubscribed with subscriber :req.user and channel:with channelid from subscription model
    3.check issubscribed if is thruthy value then delete isSubscribed.id and return unsubscribe successfully
    4.if not then create both and return subscription successfully
    */
    
    const {channelId} = req.params

    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "Invalid ChannelId")
    }

    const isSubscribed = await Subscription.findOne({
        subscriber:req.user?._id,
        channel:channelId
    })

    if(isSubscribed){
        await Subscription.findByIdAndDelete(isSubscribed?._id);
        return res.status(200)
        .json(new ApiResponse(
            200, {
                subscribed:false
            },
            "Unsubscribed successfully"
        ))
    }

    await Subscription.create({
        subscriber:req.user?._id,
        channel:channelId
    })

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            {
                subscribed:true
            },
            "subscribed successfully"
        )
    )
})

//controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async(req, res)=>{
    let {channelId} = req.params

    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "Invalid channelId")
    }

    channelId = new mongoose.Types.ObjectId(channelId);

    /*
    1.$match with channelid got from req.params with channel which is field in subscription colllection
    2.$lookup from "users" collection _id field with "subscriber" localField from subscription collection and save as "subscriber"
    3.then down fruther subpieline (pipeline)
    4.lookup from "subscription " collection channel with "_id" from "user" collection as subscribedToSubscriber,
    5.then addfields , subscribedToSubscriber and write a conditons
    6.$cond if channelId which we get from the req.params is presnet in $subscribedToSubscriber.subsciber   
    7.then add new field subscriber count using $size: $subscribedToSubscriber
    8.then back to main lookup 
    9.And unwind subscriber which we get from first lookup
    10.Project value from subscriber: _id, username, fullName, avatar, subscribedToSubscriber, subscribercount
    */
    const subscriber = await Subscription.aggregate([
        {
            $match:{
                channel:channelId
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"subscriber",
                foreignField:"_id",
                as:"subscriber",
                pipeline:[
                    {
                        $lookup:{
                            from:"subscriptions",
                            localField:"_id",
                            foreignField:"channel",
                            as:"subscribedToSubscriber"
                        }
                    },
                    {
                        $addFields:{
                            subscribedToSubscriber:{
                                $cond:{
                                    if:{
                                        $in:[
                                            channelId,
                                            "$subscribedToSubscriber"
                                        ]
                                   },
                                   then:true,
                                   else:false
                                }
                            },
                            subscribersCount:{
                                $size:"$subscribedToSubscriber"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind:"$subscriber"
        },
        {
            $project:{
                _id:0,
                subscriber:{
                    _id:1,
                    username:1,
                    fullName:1,
                    avatar:1,
                    subscribedToSubscriber:1,
                    subscriberCount:1
                }
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200, 
            subscriber,
            "subscriber fetched Successfully"
        )
    )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async(req, res)=>{
    const {subscriberId} = req.params

    /*
    1.$match subscriber field with subscriber id from req.params
    2.$lookup from users collection id field1 and from subscription collection channel field save as subscribedchannel.
    3.then fruther down one more(pipeline) subpieline added in previous lookup to fetch videos
    4.$lookup from video collection local owner field to users _id field as "videos"
    5.then addfields as latestVideos and return last document from "videos" $last
    6.then close the previous to previous lookup and go to the first $lookup
    7. $unwind the "subscribedChannel" we got from lookup
    8.then $Project some value form subscribedChannel:, id, username, fullName, avatar, lastVideo:{
        id vidofile, thumbnail, title, owner, description, duration, createdAt, views
    }
    */
    
    const subscribedChannnels = await Subscription.aggregate([
        {
            $match:{
                subscriber:new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"channel",
                foreignField:"_id",
                as:"subscribedChannel",
                pipeline:[
                    {
                        $lookup:{
                            from:"videos",
                            localField:"_id",
                            foreignField:"owner",
                            as:"videos"
                        }
                    },
                    {
                        $addFields:{
                            latestVideo:{
                                $last:"$videos"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind:"$subscribedChannel"
        },
        {
            $project:{
                _id:0,
                subscribedChannnel:{
                    _id:1,
                    username:1,
                    fullName:1,
                    avatar:1,
                    latestVideo:{
                        _id:1,
                        videoFile:1,
                        thumbnail:1,
                        owner:1,
                        title:1,
                        description:1,
                        duration:1,
                        createdAt:1,
                        views:1
                    }
                }
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(200, subscribedChannnels, "Subscribed channles fetched successfully")
    )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
