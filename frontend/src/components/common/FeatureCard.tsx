import React from 'react';
import '../../styling/common/cards.css';

interface FeatureCardProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
     title,
     description,
     icon,
     onClick,
     disabled = false,
     className = ''
 }) => {
    return (
        <div
            className={`feature-card ${disabled ? 'disabled' : ''} ${className}`}
            onClick={disabled ? undefined : onClick}
        >
            {icon && <div className="feature-card-icon">{icon}</div>}
            <div className="feature-card-content">
                <h3 className="feature-card-title">{title}</h3>
                <p className="feature-card-description">{description}</p>
            </div>
        </div>
    );
};

export default FeatureCard;
