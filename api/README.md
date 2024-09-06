# Converse API

The Converse API is a powerful backend service that allows you to manage and interact with text-to-speech (TTS) sessions through a set of well-defined API endpoints. Built as an AWS SAM (Serverless Application Model) application, it leverages the scalability and security of AWS while providing a robust and flexible interface for your application's needs.

## Features

### 1. Create Reader
**Endpoint**: `/create-reader`

**Method**: `POST`

**Description**: Initializes a new reader session by accepting a large body of text and a session name. This endpoint processes the text, identifies the number of voices required, and stores the session for future use. The conversation index is initialized at 0, allowing sequential reading.

**Parameters**:
- `text`: The body of text to be read.
- `session_name`: A unique name for the reader session.

**CRUD Operations**:
- **Create**: Initialize a new reader session.
- **Read**: Retrieve the reader session information.
- **Update**: Modify the existing reader session details.
- **Delete**: Remove a reader session.

### 2. Read
**Endpoint**: `/read`

**Method**: `GET`

**Description**: Retrieves the next voice data file chunk from the initialized reader session, along with a `chunk_id` to indicate which part of the text is being read. This allows the API user to keep track of the progress in reading the session.

**Parameters**:
- `session_name`: The name of the reader session.
- `chunk_id`: (Optional) The ID of the last retrieved chunk, to get the subsequent chunk.

## Setup and Requirements

To work with this project, ensure you have the following tools installed:

- **AWS SAM CLI**: [Install the AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- **Node.js 20.x**: [Install Node.js](https://nodejs.org/en/)
- **Docker**: [Install Docker Community Edition](https://hub.docker.com/search/?type=edition&offering=community)

These tools will allow you to build, test, and deploy the project both locally and to AWS.

## Deployment

This API is deployed as an AWS SAM application. Follow these steps to deploy:

1. **Clone the Repository**:
    ```bash
    git clone https://github.com/jamespuckett/converse.git
    cd converse/api
    ```

2. **Build the Application**:
    ```bash
    sam build
    ```

3. **Deploy the Application**:
    ```bash
    sam deploy --guided
    ```
    Follow the prompts to configure your AWS settings.

The prompts include:
- **Stack Name**: Unique to your account and region (e.g., your project name).
- **AWS Region**: The region where you want to deploy your app.
- **Confirm Changes Before Deploy**: Optionally view the change set before deployment.
- **Allow IAM Role Creation**: Choose whether SAM can create the necessary IAM roles.
- **Save Parameters to `samconfig.toml`**: Store your deployment configurations for future ease of use.

## Local Development and Testing

### Build Your Application
```bash
sam build
```
This command will install dependencies and prepare a deployment package in the `.aws-sam/build` folder.

### Invoke Functions Locally
To test specific functions, invoke them with a test event using the following commands:
```bash
sam local invoke postCreateReaderFunction --event ./events/event-post-create-reader.json
sam local invoke getAllItemsFunction --event ./events/event-get-all-items.json
```

### Emulate the API Locally
To run the API locally on port 3000:
```bash
sam local start-api
curl http://localhost:3000/
```

To test the `create-reader` endpoint locally using `curl`:
```bash
curl --location --request POST 'http://localhost:3000/create-reader' \
--header 'Content-Type: application/json' \
--data-raw '{
    "text": "Bret Stephens: Hi, Gail. How do you feel about price controls?\n\nGail Collins: Bret, we’ve spent a long time agreeing about stuff, thanks to our shared loathing of Donald Trump.",
    "session_name": "sample-session"
}'
```

This will invoke the `/create-reader` endpoint locally with a sample text and session name.

## Usage

Once deployed, you can interact with the API endpoints using standard HTTP methods. For example, to create a new reader session, you might send a `POST` request to the `/create-reader` endpoint with the required parameters.

## Contributing

We welcome contributions to improve the Converse API. Please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## Author

**James Puckett**  
[GitHub Profile](https://github.com/jamespuckett)

## Acknowledgments

- AWS for providing the serverless infrastructure.
- The open-source community for continuous support and innovation.