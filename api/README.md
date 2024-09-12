# Converse API

The Converse API is a powerful backend service that allows you to manage and interact with text-to-speech (TTS) sessions through a set of well-defined API endpoints. Built using AWS SAM (Serverless Application Model), it provides scalable and secure functionality with AWS services such as Lambda, SQS, and DynamoDB.

## Features

### 1. Narrate Conversation
**Endpoint**: `/narrate-conversation`

**Method**: `POST`

**Description**: Initializes a new TTS session by accepting a text input. The service breaks the text into parts and queues each part for voice generation using the OpenAI API.

**Parameters**:
- `text`: The body of text to be narrated.
- `session_name`: A unique identifier for the narration session.

### 2. Check Narration Status
**Endpoint**: `/check-narration-status/{session_name}`

**Method**: `GET`

**Description**: Retrieves the current status of a narration session, including whether the TTS generation is complete and the list of generated audio files.

**Parameters**:
- `session_name`: The name of the session to check.

## Setup and Requirements

To work with this project, ensure you have the following tools installed:

- **AWS SAM CLI**: [Install the AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- **Node.js 20.x**: [Install Node.js](https://nodejs.org/en/)
- **Docker**: [Install Docker Community Edition](https://hub.docker.com/search/?type=edition&offering=community)

These tools will allow you to build, test, and deploy the project locally and to AWS.

## Deployment

This API is deployed as an AWS SAM application. The deployment process is flexible, allowing you to use AWS SSM parameters or fallback values depending on the deployment environment.

### First-Time Deployment

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

    During the guided deployment, you will be prompted for several parameters, including:

    - **Stack Name**: The name of the CloudFormation stack.
    - **AWS Region**: The AWS region where you want to deploy the stack.
    - **UseSSMParameters**: You will be asked whether to use SSM parameters (`true`) or fallback values (`false`). Select `true` to use SSM parameters stored in AWS, or `false` for initial deployment or local development.
    - **Allow IAM Role Creation**: Confirm the creation of necessary IAM roles.
    - **Save Parameters to `samconfig.toml`**: Save the configuration to simplify future deployments.

### Use of `UseSSMParameters`

The `UseSSMParameters` flag allows you to control whether to use values from AWS Systems Manager (SSM) Parameter Store or fallback values for local development or first-time deployment. This setting can be passed during deployment:

```bash
sam deploy --guided --parameter-overrides UseSSMParameters=true
```

When `UseSSMParameters` is set to `true`, AWS SAM will retrieve secrets (like OpenAI API keys) and other configuration values from SSM. If set to `false`, it will use fallback values specified in the `template.yaml`.

### Local Development and Testing

To emulate the API locally and test its functionality, follow these steps:

1. **Build the Application**:
    ```bash
    sam build
    ```

2. **Start the API Locally**:
    ```bash
    sam local start-api
    ```

    This will start the API on `http://localhost:3000`.

3. **Invoke the Endpoints Locally**:

    You can use `curl` to test the `narrate-conversation` and `check-narration-status` endpoints:

    - **POST to Narrate Conversation**:
      ```bash
      curl --location --request POST 'http://localhost:3000/narrate-conversation' \
      --header 'Content-Type: application/json' \
      --data-raw '{
          "text": "Bret: Hi, Gail. How do you feel about price controls? Gail: this is seriuos talk.",
          "session_name": "sample-session"
      }'
      ```

    - **GET to Check Narration Status**:
      ```bash
      curl --location --request GET 'http://localhost:3000/check-narration-status/sample-session'
      ```

### CRUD Operations
- **Create**: Initialize a new narration session.
- **Read**: Retrieve the narration session information, including generated audio files.
- **Update**: Modify an existing session (if applicable).
- **Delete**: Remove a session (future feature).

## Usage

Once deployed, you can interact with the API using the following endpoints:

- **`/narrate-conversation` (POST)**: Send text to be narrated by OpenAI TTS and generate audio files.
- **`/check-narration-status/{session_name}` (GET)**: Check the status of the narration and retrieve the list of generated audio files.

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
