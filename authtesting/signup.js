const signInButton =  document.getElementById("SignIn");
const usernameField = document.getElementById("username");
const passwordField = document.getElementById("userPassword");

signInButton.addEventListener('click', (event) => {
    const client = new Appwrite.Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1') // Your API Endpoint
    .setProject('6aecdaf8003b7e90e34b');                 // Your project ID

    const account = new Appwrite.Account(client);


    const user = account.create({
        userId: Appwrite.ID.unique(), 
        email: usernameField.value, 
        password: passwordField.value
    });
});
