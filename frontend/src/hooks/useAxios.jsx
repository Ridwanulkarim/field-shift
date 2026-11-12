import axios from "axios";

// Set VITE_API_URL (for example in frontend/.env.local) to use a local backend; otherwise the deployed API is used.
const axiosInstance = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || "https://field-shift-qfv8.onrender.com/api",
  withCredentials: true,
});

const useAxios = () => {
  return axiosInstance;
};

export default useAxios;
