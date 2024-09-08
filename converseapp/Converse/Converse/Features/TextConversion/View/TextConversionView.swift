import SwiftUI
import AVFoundation

struct TextConversionView: View {
    @State private var inputText: String = ""
    @State private var audioFiles: [URL] = []
    @State private var isLoading = false
    @StateObject private var audioPlayer = AudioPlayer()

    var body: some View {
        NavigationView {
            VStack {
                TextEditor(text: $inputText)
                    .frame(height: 200)
                    .border(Color.gray, width: 1)
                    .padding()

                Button("Convert Text") {
                    convertTextToConversation()
                }
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(8)

                if !audioFiles.isEmpty {
                    AudioPlayerView(audioFiles: $audioFiles)
                }

                Spacer()
            }
            .navigationTitle("Converse")
        }
    }

    func convertTextToConversation() {
        // Networking code to POST inputText and receive URLs of audio files
        isLoading = true
        NetworkingManager.shared.postTextForConversion(text: inputText, sessionName: "iOSAppSession") { result in
            DispatchQueue.main.async {
                isLoading = false
                switch result {
                case .success(let urls):
                    audioFiles = urls
                case .failure(let error):
                    print("Error: \(error.localizedDescription)")
                    // Handle error - show an alert or similar
                }
            }
        }
    }
}

struct AudioPlayerView: View {
    @Binding var audioFiles: [URL]
    @EnvironmentObject var audioPlayer: AudioPlayer

    var body: some View {
        VStack {
            if let currentItem = audioPlayer.currentItem {
                Text("Now Playing: \(currentItem.lastPathComponent)")
                    .padding()
            }

            HStack {
                Button(action: {
                    audioPlayer.playPause()
                }) {
                    Image(systemName: audioPlayer.isPlaying ? "pause.fill" : "play.fill")
                }

                Button("Next") {
                    audioPlayer.nextTrack()
                }
            }
            .padding()
        }
    }
}

#Preview {
    TextConversionView()
}
