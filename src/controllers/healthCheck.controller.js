import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/AsyncHandler.js"


const healthcheck = asyncHandler(async (req, res) => {
    // build a healthcheck response that simply returns the OK status as json with a message
    try {
        return res.status(200).json(
            new ApiResponse(200, 
                {
                    message:"Everything is working ok"
                },
                "Ok"
            )
        )
    } catch (error) {
        throw new ApiError(400, error.message || "Error in asyncHandler function")
    }
})

export {
    healthcheck
    }