import Foundation
import Vision
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.recognitionLanguages = ["es-ES", "en-US"]
req.usesLanguageCorrection = false
let h = VNImageRequestHandler(url: url, options: [:])
try h.perform([req])
for o in (req.results ?? []) { if let c = o.topCandidates(1).first { print(c.string) } }
