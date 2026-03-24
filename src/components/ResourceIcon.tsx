import { imageByResourceId, emojiByResourceId, ResourceImgType } from '../utils/resourceUtils';

interface ResourceIconProps {
  id: number;
  type?: ResourceImgType;
  size?: number;
  style?: React.CSSProperties;
}

export function ResourceIcon({ id, type = 'inventory', size = 24, style }: ResourceIconProps) {
  const imgSrc = imageByResourceId(id, type);
  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt=""
        style={{ width: size, height: size, objectFit: 'contain', display: 'block', ...style }}
      />
    );
  }
  return (
    <span style={{ fontSize: size * 0.85, lineHeight: 1, display: 'inline-block', ...style }}>
      {emojiByResourceId(id)}
    </span>
  );
}
