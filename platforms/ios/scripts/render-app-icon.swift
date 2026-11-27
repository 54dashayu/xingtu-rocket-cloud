import Foundation
import CoreGraphics
import ImageIO
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let source = CGImageSourceCreateWithURL(input as CFURL, nil)!
let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 4096, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.draw(image, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
let dest = CGImageDestinationCreateWithURL(output as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(dest, context.makeImage()!, nil)
assert(CGImageDestinationFinalize(dest))
