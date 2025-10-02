import React from 'react'
import { ToastContainer, ToastContainerProps } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useThemeMode } from '../../contexts/ThemeModeContext'

const ThemedToastContainer: React.FC<Partial<ToastContainerProps>> = (props) => {
  const { mode } = useThemeMode()
  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={mode}
      limit={5}
      {...props}
    />
  )
}

export default ThemedToastContainer


