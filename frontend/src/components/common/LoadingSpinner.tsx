import React from 'react';
import '../../styling/common/loadingSpinner.css';

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large';
    message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
   size = 'medium',
   message = 'Loading...'
}) => {
    return (
        <div className="loading-container">
            <div className={`loading-spinner ${size}`}></div>
            {message && <p className="loading-message">{message}</p>}
        </div>
    );
};

export default LoadingSpinner;
