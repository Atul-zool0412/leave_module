import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.BASE_URL;

export const callRestApi = async (url: string) => {
  const response = await axios.get(`${BASE_URL}${url}`);
  return response.data;
};
