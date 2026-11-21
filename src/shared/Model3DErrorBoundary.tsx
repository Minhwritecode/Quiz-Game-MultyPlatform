import React, { Component, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  /** Fallback JSX khi 3D bị lỗi */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Error Boundary bảo vệ Model3DView / WebView khỏi làm crash toàn màn hình.
 * Khi WebView hoặc GLB parser gặp lỗi, hiển thị fallback UI thay vì crash.
 */
export class Model3DErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  override componentDidCatch(error: Error) {
    // Silent catch — không log lên Sentry vì đây là expected fallback
    console.warn('[Model3DErrorBoundary] 3D rendering failed, switching to 2D:', error.message);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultFallback />;
    }
    return this.props.children;
  }
}

function DefaultFallback() {
  return (
    <View style={styles.fallback}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.text}>3D không khả dụng</Text>
      <Text style={styles.sub}>Chuyển sang chế độ 2D</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 16,
    padding: 24,
    gap: 8,
  },
  icon: { fontSize: 36 },
  text: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  sub: { fontSize: 12, color: '#64748B' },
});
