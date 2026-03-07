<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-green-500 text-black hover:bg-green-400 active:bg-green-600',
        ghost: 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white',
        destructive: 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 active:bg-red-500/35',
        outline: 'border border-zinc-700/50 bg-zinc-800/30 text-zinc-300 hover:bg-zinc-800/50 hover:text-white',
        secondary: 'bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700/60',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant'];
    size?: ButtonVariants['size'];
    class?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }>(),
  { type: 'button' },
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </button>
</template>
