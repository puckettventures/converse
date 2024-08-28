# Converse

![Converse Logo](./logo.png)

Converse is an innovative mobile application designed to help users effortlessly listen to transcripts or articles on demand. The app intelligently detects different voices within text and utilizes AI-generated voices to deliver an immersive listening experience.

## Features

- **Voice Differentiation**: Automatically detects and assigns different AI voices to various speakers in a transcript.
- **On-Demand Playback**: Allows users to listen to articles and transcripts anywhere, anytime.
- **Cross-Platform Support**: Mobile application designed for iOS.

## Getting Started

### Prerequisites

- **iOS Device**: Converse is currently designed for iOS devices.
- **AWS Account**: Required for deploying the backend microservice.
- **Swift**: The mobile app is written in Swift.

### Installation

1. **Clone the Repository**

    ```bash
    git clone https://github.com/jamespuckett/converse.git
    cd converse
    ```

2. **Set Up Backend**

   Navigate to the `/api` directory to set up the AWS microservice.

    ```bash
    cd api
    # Follow instructions in the api/README.md to deploy the microservice.
    ```

3. **Set Up Mobile App**

   Navigate to the `/converseapp` directory to work on the iOS client application.

    ```bash
    cd converseapp
    # Open the project in Xcode and run it on your device or simulator.
    ```

### Project Structure

- **`/api`**: Backend AWS microservice.
- **`/converseapp`**: Client mobile application written in Swift for iOS.

## Usage

Once installed, open the Converse app on your iOS device, choose an article or transcript, and start listening. The app will automatically adjust voices based on the content.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**James Puckett**  
[GitHub Profile](https://github.com/puckettventures)

## Acknowledgments

- Special thanks to the open-source community for providing valuable tools and resources.
- AI voice technology powered by [Mozilla TTS](https://github.com/mozilla/TTS).

---

*Converse - Listen to your content, your way.*
