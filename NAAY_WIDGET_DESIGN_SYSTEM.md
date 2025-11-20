# Naay Chat Widget - Ultra-Modern Design System

## Overview
The Naay chat widget has been completely redesigned with an ultra-modern, minimalist, and avant-garde approach that perfectly aligns with the premium cosmetics brand aesthetic. This design system ensures consistency, accessibility, and premium user experience.

## Brand Colors & Usage

### Primary Color Palette
The widget uses Naay's sophisticated brand color palette:

| Color Name | Hex Code | Usage | Description |
|------------|----------|-------|-------------|
| **Everyday** | `#E8B5A1` | Accent gradients, warm elements | Soft coral/salmon for warmth |
| **Fresh** | `#8FA68E` | Status indicators, botanical elements | Sage green for nature/freshness |
| **Delicate** | `#D4C4B8` | Subtle backgrounds, gradients | Soft taupe for elegance |
| **Forever** | `#B8A882` | Secondary elements | Olive beige for stability |
| **Hydra** | `#A8C4C4` | Header gradients, focus states | Soft blue-gray for calm |
| **Deep** | `#D4B82C` | Future accent use | Mustard yellow for energy |
| **Rich** | `#B8943C` | Button hover states | Golden brown for luxury |
| **Radiant** | `#A68A3C` | Future accent use | Olive gold for premium |
| **Perfect** | `#A8826B` | Primary buttons, main branding | Warm brown for trust |
| **White** | `#FEFEFE` | Backgrounds, text on dark | Pure white for clarity |
| **Charcoal** | `#2A2A2A` | Primary text, headings | Deep charcoal for readability |
| **Sage** | `#F8F9F8` | Input fields, subtle backgrounds | Sage white for comfort |

### Color Usage Guidelines

1. **Primary Actions**: Use `Perfect` (#A8826B) for main call-to-action buttons
2. **Hover States**: Use `Rich` (#B8943C) for interactive element hover states
3. **Gradients**: Combine complementary colors like `Hydra + Delicate` for backgrounds
4. **Status Elements**: Use `Fresh` (#8FA68E) for positive status indicators
5. **Text**: Use `Charcoal` (#2A2A2A) for primary text, with opacity variations for hierarchy

## Typography System

### Font Family
- **Primary**: Inter (Google Fonts)
- **Fallback**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- **Font Features**: Advanced OpenType features enabled for premium appearance

### Typography Hierarchy

| Element | Font Size | Font Weight | Line Height | Letter Spacing |
|---------|-----------|-------------|-------------|----------------|
| **Chat Title** | 24px | 700 | - | -0.02em |
| **Welcome Title** | 18px | 600 | - | -0.01em |
| **Body Text** | 15px | 400 | 1.6 | - |
| **Input Text** | 15px | 400 | 1.4 | - |
| **Feature Text** | 14px | 500 | 1.4 | - |
| **Promo Text** | 14px | 500 | 1.4 | -0.01em |
| **Subtitle** | 14px | 500 | - | - |
| **Status Text** | 13px | 500 | - | - |
| **Footer Text** | 12px | 400 | - | 0.01em |

## Component Specifications

### 1. Promotional Message (.naay-promo)
- **Purpose**: Elegant invitation to start conversation
- **Style**: Glassmorphism with subtle backdrop blur
- **Animation**: Smooth slide and scale on hover
- **Colors**: White background with Hydra border
- **Features**: Botanical leaf icon with rotation animation

### 2. Trigger Button (.naay-trigger)
- **Size**: 72px × 72px circular
- **Background**: Gradient from Perfect to Rich
- **Shadow**: Layered shadows for depth
- **Animation**: Icon transition with rotation and scaling
- **Interactive States**: Hover lift, active press, pulse animation

### 3. Chat Interface (.naay-chat)
- **Dimensions**: 420px × 640px (responsive)
- **Background**: White with glassmorphism effects
- **Border Radius**: 24px for modern rounded corners
- **Shadow**: Multi-layered shadows for premium depth
- **Animation**: Scale and fade entrance

### 4. Header (.naay-chat__header)
- **Background**: Gradient from Hydra to Delicate
- **Avatar**: 56px circular with white background overlay
- **Status Indicator**: Pulsing Fresh green dot
- **Close Button**: Glassmorphism with blur effect

### 5. Input Field (.naay-input)
- **Background**: Sage with subtle border
- **Border Radius**: 16px for modern pill shape
- **Focus State**: Hydra border with soft shadow
- **Send Button**: Perfect background with Rich hover state

## Animations & Micro-interactions

### 1. Entrance Animations
- **Chat Window**: Scale from 0.95 to 1.0 with opacity fade
- **Promotional**: Slide from right with scale effect
- **Duration**: 400ms with cubic-bezier(0.4, 0, 0.2, 1)

### 2. Hover Effects
- **Button Lift**: translateY(-2px) with shadow enhancement
- **Scale Effects**: 1.02 - 1.05 scale for interactive elements
- **Color Transitions**: 300ms ease for smooth color changes

### 3. Status Animations
- **Pulse Effect**: 2s infinite for status indicators
- **Botanical Rotation**: 15° to 0° on hover
- **Icon Transitions**: 90° rotations for state changes

## Accessibility Features

### 1. ARIA Labels
- All interactive elements have descriptive aria-labels
- Chat interface uses proper dialog role
- Messages area has live region for screen readers

### 2. Semantic HTML
- Proper heading hierarchy (h1, h2)
- Navigation elements for feature lists
- Form elements for input areas

### 3. Keyboard Navigation
- All interactive elements are focusable
- Escape key closes the widget
- Enter key submits messages

### 4. Reduced Motion Support
- Respects `prefers-reduced-motion` media query
- Removes animations for users who prefer reduced motion

## Responsive Design

### Breakpoints
- **Mobile**: 520px and below
- **Small Mobile**: 380px and below

### Mobile Adaptations
- Chat window becomes nearly full-screen
- Promotional message repositions
- Button sizes remain touch-friendly
- Typography scales appropriately

## Implementation Guidelines

### 1. Color Usage
- Always use CSS custom properties (--naay-*)
- Maintain color consistency across components
- Use opacity for text hierarchy instead of different colors

### 2. Spacing System
- Base spacing unit: 4px
- Common spacing: 8px, 12px, 16px, 20px, 24px, 32px
- Consistent padding and margins throughout

### 3. Shadow System
- **Subtle**: 0 2px 8px rgba(42, 42, 42, 0.04)
- **Medium**: 0 8px 32px rgba(42, 42, 42, 0.08)
- **Strong**: 0 20px 60px rgba(42, 42, 42, 0.1)

### 4. Border Radius System
- **Small**: 8px - 12px for buttons and inputs
- **Medium**: 16px - 18px for cards and messages
- **Large**: 24px for main containers
- **Circle**: 50% for avatars and status indicators

## Performance Considerations

### 1. Font Loading
- Uses font-display: swap for better performance
- Fallback fonts closely match Inter metrics
- Font features loaded only when needed

### 2. Animations
- Hardware-accelerated transforms (translate3d, scale)
- Will-change property for optimized layers
- Minimal reflows and repaints

### 3. CSS Optimization
- Consolidated CSS custom properties
- Efficient selectors with proper specificity
- Minimal DOM manipulation

## Future Enhancements

### 1. Theme Variants
- Dark mode support using color system
- High contrast mode for accessibility
- Seasonal color variations

### 2. Advanced Interactions
- Gesture support for mobile
- Voice input integration
- Enhanced micro-animations

### 3. Personalization
- Dynamic color adaptation
- User preference memory
- Contextual messaging

## Maintenance Guidelines

### 1. Color Updates
- Always update CSS custom properties
- Test color contrast ratios
- Verify accessibility standards

### 2. Component Updates
- Maintain consistent naming conventions
- Test across all breakpoints
- Validate semantic HTML structure

### 3. Performance Monitoring
- Monitor animation performance
- Check font loading metrics
- Validate responsive behavior

This design system ensures the Naay chat widget maintains its premium, sophisticated aesthetic while providing excellent user experience and accessibility across all devices and use cases.