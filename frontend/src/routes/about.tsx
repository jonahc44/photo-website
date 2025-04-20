import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import '../global.css'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
    
}