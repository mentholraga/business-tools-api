const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors({
  origin: ['https://mentholraga.github.io', 'http://localhost:3000', 'https://yourdomain.com'],
  credentials: true
}));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Increased to 15 requests per windowMs for multiple tools
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  }
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Business Tools API is running!',
    version: '1.0.0',
    endpoints: [
      'POST /api/swot - Generate SWOT analysis',
      'POST /api/messaging - Generate product messaging framework',
      'POST /api/competitor - Analyze competitors (coming soon)',
      'POST /api/personas - Generate customer personas (coming soon)'
    ]
  });
});

// SWOT Analysis endpoint
app.post('/api/swot', async (req, res) => {
  try {
    const { company, industry, additionalContext } = req.body;

    // Validation
    if (!company || company.trim().length === 0) {
      return res.status(400).json({
        error: 'Company name is required'
      });
    }

    if (company.length > 100) {
      return res.status(400).json({
        error: 'Company name too long (max 100 characters)'
      });
    }

    // Create the prompt for OpenAI
    const prompt = `
Conduct a comprehensive SWOT analysis for ${company}${industry ? ` in the ${industry} industry` : ''}${additionalContext ? `. Additional context: ${additionalContext}` : ''}.

Please provide a detailed SWOT analysis with:
- 4-6 key points for each category (Strengths, Weaknesses, Opportunities, Threats)
- Specific, actionable insights rather than generic statements
- Current market context and recent developments
- Focus on strategic implications

Format your response as a JSON object with this exact structure:
{
  "company": "${company}",
  "industry": "${industry || 'Not specified'}",
  "analysis": {
    "strengths": [
      {"point": "Strength title", "description": "Detailed explanation"}
    ],
    "weaknesses": [
      {"point": "Weakness title", "description": "Detailed explanation"}
    ],
    "opportunities": [
      {"point": "Opportunity title", "description": "Detailed explanation"}
    ],
    "threats": [
      {"point": "Threat title", "description": "Detailed explanation"}
    ]
  },
  "keyInsights": [
    "Most critical insight",
    "Second most important insight",
    "Third key strategic point"
  ],
  "recommendations": [
    "Primary strategic recommendation",
    "Secondary recommendation",
    "Risk mitigation suggestion"
  ]
}

Ensure the response is valid JSON only, with no additional text or formatting.`;

    console.log(`SWOT request for: ${company}`);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a strategic business analyst with deep expertise in competitive analysis and market research. Provide thorough, accurate, and actionable SWOT analyses based on current market information."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse the JSON response
    let swotAnalysis;
    try {
      swotAnalysis = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw response:', responseText);
      
      // Fallback: try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        swotAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    // Add metadata
    swotAnalysis.metadata = {
      generatedAt: new Date().toISOString(),
      model: 'gpt-4o-mini',
      version: '1.0.0'
    };

    res.json(swotAnalysis);

  } catch (error) {
    console.error('SWOT Analysis Error:', error);

    if (error.code === 'insufficient_quota') {
      return res.status(429).json({
        error: 'API quota exceeded. Please try again later.',
        code: 'QUOTA_EXCEEDED'
      });
    }

    if (error.code === 'rate_limit_exceeded') {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before making another request.',
        code: 'RATE_LIMITED'
      });
    }

    res.status(500).json({
      error: 'Failed to generate SWOT analysis. Please try again.',
      code: 'ANALYSIS_FAILED'
    });
  }
});

// Product Messaging Framework endpoint
app.post('/api/messaging', async (req, res) => {
  try {
    const { 
      company, 
      product, 
      targetAudience, 
      keyFeatures, 
      competitors, 
      businessGoals,
      industry,
      tonePreference 
    } = req.body;

    // Validation
    if (!company || company.trim().length === 0) {
      return res.status(400).json({
        error: 'Company name is required'
      });
    }

    if (!product || product.trim().length === 0) {
      return res.status(400).json({
        error: 'Product/service name is required'
      });
    }

    // Create the prompt for OpenAI
    const prompt = `
Create a comprehensive product messaging framework for ${company}'s ${product}${industry ? ` in the ${industry} industry` : ''}.

Company Details:
- Company: ${company}
- Product/Service: ${product}
- Target Audience: ${targetAudience || 'Not specified'}
- Key Features: ${keyFeatures || 'Not specified'}
- Main Competitors: ${competitors || 'Not specified'}
- Business Goals: ${businessGoals || 'Not specified'}
- Preferred Tone: ${tonePreference || 'Professional and engaging'}

Generate a complete messaging framework that includes:

1. Value Proposition (10-15 words, clear and compelling)
2. Target Audience Profile (brief persona description)
3. Elevator Pitch (1-2 sentences incorporating value prop)
4. Long Description (100-200 words with benefits, features, proof points)
5. Tone of Voice (3-4 adjectives with before/after examples)
6. Key Outcomes (3-5 bullet points)
7. Customer Requirements (2-3 crucial conversion factors)
8. Three Outcome Pillars with detailed breakdowns

Format your response as a JSON object with this exact structure:
{
  "company": "${company}",
  "product": "${product}",
  "industry": "${industry || 'Not specified'}",
  "valueProposition": "10-15 word clear value statement",
  "targetAudience": {
    "profile": "Brief persona description including personality, responsibilities, title, role in buying process"
  },
  "elevatorPitch": "1-2 sentences incorporating value proposition and target market",
  "longDescription": "100-200 words including value points, features, benefits, target market, proof points",
  "toneOfVoice": {
    "adjectives": ["adjective1", "adjective2", "adjective3", "adjective4"],
    "beforeExample": "Example of how NOT to communicate",
    "afterExample": "Example of ideal communication style"
  },
  "outcomes": [
    "Specific outcome #1",
    "Specific outcome #2", 
    "Specific outcome #3",
    "Specific outcome #4",
    "Specific outcome #5"
  ],
  "customerRequirements": [
    "Crucial requirement #1 for conversion",
    "Crucial requirement #2 for conversion"
  ],
  "outcomePillars": [
    {
      "pillarName": "Pillar 1 Name",
      "painPoints": [
        "Pain point this pillar solves #1",
        "Pain point this pillar solves #2"
      ],
      "benefits": [
        "Benefit #1",
        "Benefit #2", 
        "Benefit #3"
      ],
      "featureDetails": [
        "Feature detail #1",
        "Feature detail #2",
        "Feature detail #3"
      ],
      "proofPoint": "Real-life case study example showing results"
    },
    {
      "pillarName": "Pillar 2 Name",
      "painPoints": [
        "Pain point this pillar solves #1",
        "Pain point this pillar solves #2"
      ],
      "benefits": [
        "Benefit #1",
        "Benefit #2",
        "Benefit #3"
      ],
      "featureDetails": [
        "Feature detail #1", 
        "Feature detail #2",
        "Feature detail #3"
      ],
      "proofPoint": "Real-life case study example showing results"
    },
    {
      "pillarName": "Pillar 3 Name",
      "painPoints": [
        "Pain point this pillar solves #1",
        "Pain point this pillar solves #2"
      ],
      "benefits": [
        "Benefit #1",
        "Benefit #2",
        "Benefit #3"
      ],
      "featureDetails": [
        "Feature detail #1",
        "Feature detail #2", 
        "Feature detail #3"
      ],
      "proofPoint": "Real-life case study example showing results"
    }
  ]
}

Ensure the response is valid JSON only, with no additional text or formatting. Make the messaging specific, actionable, and tailored to the provided context.`;

    console.log(`Messaging request for: ${company} - ${product}`);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert marketing strategist and copywriter with extensive experience in product positioning, messaging frameworks, and brand communication. Create compelling, strategic messaging that converts prospects into customers."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 3000, // Increased for comprehensive messaging framework
      temperature: 0.8, // Slightly higher for more creative messaging
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse the JSON response
    let messagingFramework;
    try {
      messagingFramework = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw response:', responseText);
      
      // Fallback: try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        messagingFramework = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    // Add metadata
    messagingFramework.metadata = {
      generatedAt: new Date().toISOString(),
      model: 'gpt-4o-mini',
      version: '1.0.0',
      inputParams: {
        company,
        product,
        targetAudience: targetAudience || null,
        tonePreference: tonePreference || null
      }
    };

    res.json(messagingFramework);

  } catch (error) {
    console.error('Messaging Framework Error:', error);

    if (error.code === 'insufficient_quota') {
      return res.status(429).json({
        error: 'API quota exceeded. Please try again later.',
        code: 'QUOTA_EXCEEDED'
      });
    }

    if (error.code === 'rate_limit_exceeded') {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before making another request.',
        code: 'RATE_LIMITED'
      });
    }

    res.status(500).json({
      error: 'Failed to generate messaging framework. Please try again.',
      code: 'MESSAGING_FAILED'
    });
  }
});

// Future endpoints
app.post('/api/competitor', (req, res) => {
  res.status(501).json({
    message: 'Competitor analysis coming soon!',
    status: 'under_development'
  });
});

app.post('/api/personas', (req, res) => {
  res.status(501).json({
    message: 'Customer personas generator coming soon!',
    status: 'under_development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET / - API info',
      'POST /api/swot - SWOT analysis',
      'POST /api/messaging - Product messaging framework'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Business Tools API running on port ${PORT}`);
  console.log(`📊 Ready to serve SWOT analyses, messaging frameworks, and more!`);
});

module.exports = app;