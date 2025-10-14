import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/send-email';
import { getWelcomeEmailHtml } from '@/lib/email-templates/welcome-admin-created';

// Create admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  business_name: string;
  phone_number: string;
  payment_option: string;
  payment_remaining: number;
  command_hq_link: string;
  command_hq_created: boolean;
  gd_folder_created: boolean;
  meeting_scheduled: boolean;
  role: string;
  wbt_onboarding: string;
  wbt_onboarding_type: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from an authenticated super admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if the user is a super admin
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('business_info')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || userProfile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get the user data from the request body
    const userData: CreateUserRequest = await request.json();
    
    if (!userData.email || !userData.password || !userData.full_name || !userData.business_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user already exists by looking in business_info table
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('business_info')
      .select('id')
      .eq('email', userData.email)
      .limit(1);
    
    if (checkError) {
      console.warn('Error checking existing user:', checkError);
      // Continue with user creation if we can't check
    } else if (existingUser && existingUser.length > 0) {
      return NextResponse.json({ 
        error: 'User already exists',
        details: 'A user with this email address has already been registered. Please use a different email address or contact support if you need to reset the existing account.'
      }, { status: 409 });
    }

    // Create the user using admin privileges (this doesn't log in as the new user)
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: userData.full_name,
        business_name: userData.business_name
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      
      // Handle specific error cases
      if (createError.message.includes('email_exists') || createError.message.includes('already been registered')) {
        return NextResponse.json({ 
          error: 'User already exists',
          details: 'A user with this email address has already been registered. Please use a different email address.'
        }, { status: 409 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to create user',
        details: createError.message 
      }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user - no user data returned' }, { status: 500 });
    }

    // Create business_info record
    const { error: businessError } = await supabaseAdmin
      .from('business_info')
      .insert({
        user_id: authData.user.id,
        team_id: authData.user.id,
        full_name: userData.full_name,
        business_name: userData.business_name,
        email: userData.email,
        phone_number: userData.phone_number,
        payment_option: userData.payment_option,
        payment_remaining: userData.payment_remaining,
        command_hq_link: userData.command_hq_link,
        command_hq_created: userData.command_hq_created,
        gd_folder_created: userData.gd_folder_created,
        meeting_scheduled: userData.meeting_scheduled,
        role: userData.role,
        wbt_onboarding: userData.wbt_onboarding || '',
      });

    if (businessError) {
      console.error('Error creating business_info:', businessError);
      // If business_info creation fails, we should clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ 
        error: 'Failed to create business profile',
        details: businessError.message 
      }, { status: 500 });
    }

    // Send welcome email to the new user
    try {
      // Get admin user details for email
      const { data: adminProfile } = await supabaseAdmin
        .from('business_info')
        .select('full_name, business_name')
        .eq('user_id', user.id)
        .single();

      const adminName = adminProfile?.full_name || 'Admin';
      const companyName = adminProfile?.business_name || userData.business_name;
      const loginUrl = 'https://app.tradebusinessschool.com/sign-in';

      const emailHtml = getWelcomeEmailHtml({
        invitedBy: adminName,
        companyName: companyName,
        userEmail: userData.email,
        userPassword: userData.password,
        loginUrl: loginUrl,
      });

      const emailResult = await sendEmail({
        to: userData.email,
        subject: `Welcome to Trades Business School - Your Command HQ is Ready!`,
        html: emailHtml,
      });

      if (!emailResult.success) {
        console.warn('Failed to send welcome email:', emailResult.error);
        // Don't fail the user creation if email fails
      } else {
        console.log('Welcome email sent successfully to:', userData.email);
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail the user creation if email fails
    }

    return NextResponse.json({ 
      success: true, 
      message: 'User created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: userData.full_name,
        business_name: userData.business_name,
        role: userData.role
      }
    });

  } catch (error) {
    console.error('Error in create-user API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 