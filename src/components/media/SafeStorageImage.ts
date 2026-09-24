'use client';

import { createElement, useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';

type ImageElementInput = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src?: string | null;
  fallback?: ReactNode;
  onFailure: () => void;
};

export function buildStorageImageElement({ src, fallback = null, onFailure, ...imageProps }: ImageElementInput) {
  if (!src) return fallback;
  return createElement('img', { ...imageProps, src, onError: onFailure });
}

type SafeStorageImageProps = Omit<ImageElementInput, 'onFailure'>;

export function SafeStorageImage({ src, fallback = null, ...imageProps }: SafeStorageImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return buildStorageImageElement({
    ...imageProps,
    src: failed ? null : src,
    fallback,
    onFailure: () => setFailed(true),
  });
}

