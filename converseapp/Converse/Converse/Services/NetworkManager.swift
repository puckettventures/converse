//
//  NetworkManager.swift
//  Converse
//
//  Created by James Puckett on 9/8/24.
//

import Foundation

class NetworkingManager {
    static let shared = NetworkingManager()  // Singleton instance

    func postTextForConversion(text: String, sessionName: String, completion: @escaping (Result<[URL], Error>) -> Void) {
        let urlString = "https://oqctuo1rja.execute-api.us-east-1.amazonaws.com/Prod/create-reader"
        guard let url = URL(string: urlString) else {
            completion(.failure(NetworkError.urlInvalid))
            return
        }

        let body: [String: Any] = ["text": text, "session_name": sessionName]
        guard let finalBody = try? JSONSerialization.data(withJSONObject: body) else {
            completion(.failure(NetworkError.encodingFailed))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = finalBody
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data else {
                completion(.failure(NetworkError.noData))
                return
            }
            
            print(String(data: data, encoding: .utf8))

            // Assuming the server responds with URLs of the audio files
            do {
                let urls = try JSONDecoder().decode([URL].self, from: data)
                completion(.success(urls))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}

enum NetworkError: Error {
    case urlInvalid
    case encodingFailed
    case noData
}

