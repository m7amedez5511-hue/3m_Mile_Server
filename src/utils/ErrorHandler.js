import createError from 'http-errors';

export const messageError = (status, message) => {
  const error =  createError(status,message);
  error.code = 500;
  return error
};

export const finalHandle = (error, req, res, next) => {  
  error.status = error.status || 500;
  error.message = error.message || "Invalid server error"
  // console.log(error);
  error_json = {
    status: error.status,
    date: Date.now(),
    response: {
      path: req.originalUrl,
      errors: error.details
    }
  }
  if (!error.code) {
    error_json.code = error.message
  } else {
    error_json.message = error.message
  }
  res.status(error.status).json(error_json)
};