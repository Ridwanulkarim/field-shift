import axios from "axios";

const axiosInstance = axios.create({
    baseURL: `https://field-shift-qfv8.onrender.com/api`,
    withCredentials: true,
})
const useAxios = () => {
    return axiosInstance;
};

export default useAxios;