import React from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../stores/useAuthStore'

const Profile: React.FC = () => {
    const { user } = useAuthStore()
    const navigate = useNavigate()

    return (
        <div className="container-page">
            <div >
                <h1>Bienvenido</h1>
                <h2>{user?.displayName}</h2>
                <button onClick={() => navigate('/meet')}>Unirse a la reunión</button>
            </div>
        </div>
    )
}

export default Profile