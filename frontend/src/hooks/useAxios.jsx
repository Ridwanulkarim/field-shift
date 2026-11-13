import axios from "axios";

// Use the Vite proxy locally; deployments can override this with VITE_API_URL.
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

const useAxios = () => {
  return axiosInstance;
};

export default useAxios;
