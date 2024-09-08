import AVFoundation

// Make AudioPlayer inherit from NSObject
class AudioPlayer: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published var isPlaying = false
    var audioPlayer: AVAudioPlayer?
    var audioFiles: [URL] = []
    var currentItem: URL?

    func playPause() {
        if isPlaying {
            audioPlayer?.pause()
            isPlaying = false
        } else {
            if audioPlayer == nil {
                setupPlayer()
            }
            audioPlayer?.play()
            isPlaying = true
        }
    }

    func nextTrack() {
        // Logic to move to the next audio track
        // Implement functionality to switch between files
    }

    private func setupPlayer() {
        if let currentFile = audioFiles.first {
            do {
                audioPlayer = try AVAudioPlayer(contentsOf: currentFile)
                audioPlayer?.delegate = self // Correctly sets self as delegate now that AudioPlayer inherits from NSObject
                audioPlayer?.prepareToPlay()
                currentItem = currentFile
            } catch {
                print("Failed to load audio: \(error)")
            }
        }
    }

    // Implement AVAudioPlayerDelegate methods
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        if flag {
            nextTrack() // Automatically move to the next track once one finishes playing
        }
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        print("Audio Playback Error: \(String(describing: error))")
    }
}
