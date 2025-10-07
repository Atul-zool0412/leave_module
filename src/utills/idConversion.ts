import { Binary } from "mongodb";
import { Buffer } from "buffer";

export function guidToBinary(guidValue: string): Binary {
  if (!guidValue) throw new Error("GUID value is empty");

  let bytes: Uint8Array;

  // Case 1: Base64 GUID (C# Binary)
  if (!guidValue.includes("-") && guidValue.length === 24) {
    const buffer = Buffer.from(guidValue, "base64");
    if (buffer.length !== 16) throw new Error("Invalid Base64 GUID");
    bytes = new Uint8Array(buffer);
  } else {
    // Case 2: UUID or C# GUID string
    const cleaned = guidValue.replace(/[{}]/g, "").replace(/\s+/g, "");
    const hex = cleaned.replace(/-/g, "");
    if (hex.length !== 32) throw new Error(`Invalid GUID string: ${guidValue}`);

    const buffer = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      buffer[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    bytes = new Uint8Array(buffer);
  }

  // Convert to .NET mixed-endian format (subtype 3)
  const dotnetBytes = Buffer.alloc(16);
  dotnetBytes[0] = bytes[3];
  dotnetBytes[1] = bytes[2];
  dotnetBytes[2] = bytes[1];
  dotnetBytes[3] = bytes[0];
  dotnetBytes[4] = bytes[5];
  dotnetBytes[5] = bytes[4];
  dotnetBytes[6] = bytes[7];
  dotnetBytes[7] = bytes[6];
  for (let i = 8; i < 16; i++) {
    dotnetBytes[i] = bytes[i];
  }

  return new Binary(dotnetBytes, 3); // MongoDB subtype 3
}


export function base64ToBinary(base64: string): Binary {
  return new Binary(Buffer.from(base64, "base64"), 3);
}

/**
 * Convert MongoDB Binary or Base64 string to UUID string
 */
export function binaryToUUID(binary: Binary | string): string {
  let buffer: Buffer;

  if (typeof binary === "string") {
    // if input is Base64 string
    buffer = Buffer.from(binary, "base64");
  } else {
    // if input is Binary object
    buffer = Buffer.from(binary.buffer); // <-- wrap Uint8Array in Buffer
  }

  const hex = buffer.toString("hex");

  // Insert dashes to match standard UUID format
  return `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(12, 4)}-${hex.substr(16, 4)}-${hex.substr(20, 12)}`;
}
