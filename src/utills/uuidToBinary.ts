// utils/uuidToBinary.ts
import { Binary } from "mongodb";

export const uuidToBinary = (uuid: string): Binary => {
  const hex = uuid.replace(/-/g, '');

  const part1 = Buffer.from(hex.substring(0, 8), 'hex').reverse();
  const part2 = Buffer.from(hex.substring(8, 12), 'hex').reverse();
  const part3 = Buffer.from(hex.substring(12, 16), 'hex').reverse();
  const part4 = Buffer.from(hex.substring(16, 32), 'hex'); // last 8 bytes remain in big-endian

  return new Binary(Buffer.concat([part1, part2, part3, part4]), 3);
};
