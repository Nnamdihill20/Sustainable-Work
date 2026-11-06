const signInButton =  document.getElementById("SignIn");
const usernameField = document.getElementById("username");
const passwordField = document.getElementById("userPassword");

const client = new Appwrite.Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1') // Your API Endpoint
    .setProject('6aecdaf8003b7e90e34b');                 // Your project ID
const account = new Appwrite.Account(client);

async function checkAdmin(account) {
    try {
    const jwt = await account.createJWT();

    const result = await fetch(
        "https://starter-function-1630.nyc.appwrite.run",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Appwrite-Project": "6aecdaf8003b7e90e34b",
                "x-custom-test": String(jwt.jwt)
            },
        }
    );
    const execution = await result.json();
    console.log("Function execution:", execution);
    }

    catch (error) {
        console.error(error);
    }
}

checkAdmin(account);

signInButton.addEventListener('click', async (event) => {

    const session = await account.createEmailPasswordSession({
         email: usernameField.value, 
         password: passwordField.value
    });
    
    await checkAdmin(account);
});