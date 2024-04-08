import mongoose from "mongoose"
import {DB_NAME} from "../constants.js"

const connectToDB = async() =>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_CONNECTION_URI}/${DB_NAME}`)
        console.log(`Mongodb connected ${connectionInstance.connection.host}`)
    } catch (error) {
        console.log("Mongodb not connected", error)
        process.exit(1)
    }
}

export default connectToDB

