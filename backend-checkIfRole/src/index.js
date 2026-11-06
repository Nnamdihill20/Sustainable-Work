import { Client, Account } from "node-appwrite";

export default async ({ req, res, log, error }) => {
        const corsHeaders = {
           "Access-Control-Allow-Origin": "http://localhost:8000",
           "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
           "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Appwrite-User-JWT, X-Appwrite-Project, X-Appwrite-Response-Format, X-SDK-Version, x-appwrite-user-jwt, x-appwrite-jwt, x-custom-test"
        };
	try {
                // cors is annoying
                if (req.method === "OPTIONS") {
                    return res.send("", 204, corsHeaders);
                }
		
		const jwt = req.headers["x-custom-test"];
                
		if (!jwt) {
			return res.json({success: false, message: "Not logged in"}, 401, corsHeaders);
		}
		const client = new Client()
			.setEndpoint(process.env.APPWRITE_ENDPOINT)	
			.setProject(process.env.APPWRITE_PROJECT_ID)
			.setJWT(jwt);
                log("JWT received: " + !!jwt);
                log("Attempting Appwrite authentication...");
		const account = new Account(client);

		const user = await account.get();
                log("Authenticated user: " + user.$id);
                log("User labels: " + JSON.stringify(user.labels));
                log("Is admin: " + user.labels?.includes("Admin"));

		const isAdmin = user.labels?.includes("Admin");

		if (!isAdmin) {
			return res.json({error: "Not an admin!"}, 403, corsHeaders);
		}
		// Success
		return res.json({success: true, message: "You're an authorized user!", data: {userId: user.$id, email: user.email, role: "Admin"}}, 200, corsHeaders);
	} 
	catch (err) {
		    error("Error message: " + err.message);
                    error("Error cause: " + JSON.stringify({
                    message: err.cause?.message,
                    code: err.cause?.code,
                    errno: err.cause?.errno,
                    syscall: err.cause?.syscall,
                    hostname: err.cause?.hostname
                    }));
		return res.json({success: false, message: "Failed to authenticate"}, 500, corsHeaders);
	}
};