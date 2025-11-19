// Script temporal para activar el widget por defecto
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://fuhfxjnbphvzlhkbrlha.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1aGZ4am5icGh2emxoa2JybGhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkyNDI3MSwiZXhwIjoyMDQ3NTAwMjcxfQ.vwLG8E4AvQTLJYUP3zC2zBglOm5PIaZHVq99n3QqRJE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function activateWidget() {
  try {
    console.log('Activando widget para naay-test.myshopify.com...');
    
    const shopDomain = 'naay-test.myshopify.com';
    
    // Verificar si el store existe
    const { data: existingStore, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('shop_domain', shopDomain)
      .single();
    
    if (storeError && storeError.code === 'PGRST116') {
      // Store no existe, crearlo
      console.log('Store no existe, creando...');
      
      const { data: newStore, error: createError } = await supabase
        .from('stores')
        .insert({
          shop_domain: shopDomain,
          access_token: 'placeholder_token',
          scopes: 'read_products,write_products,read_orders,read_customers,write_draft_orders',
          widget_enabled: true, // Activar widget por defecto
          installed_at: new Date(),
          updated_at: new Date()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creando store:', createError);
        return;
      }
      
      console.log('Store creado:', newStore);
    } else if (storeError) {
      console.error('Error consultando store:', storeError);
      return;
    } else {
      // Store existe, actualizar widget_enabled
      console.log('Store existe, activando widget...');
      
      const { data: updatedStore, error: updateError } = await supabase
        .from('stores')
        .update({ 
          widget_enabled: true,
          updated_at: new Date()
        })
        .eq('shop_domain', shopDomain)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error actualizando store:', updateError);
        return;
      }
      
      console.log('Store actualizado:', updatedStore);
    }
    
    // Crear configuraciones por defecto si no existen
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('shop_domain', shopDomain)
      .single();
    
    if (settingsError && settingsError.code === 'PGRST116') {
      console.log('Creando configuraciones por defecto...');
      
      const { data: newSettings, error: createSettingsError } = await supabase
        .from('app_settings')
        .insert({
          shop_domain: shopDomain,
          chat_enabled: true,
          welcome_message: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
          chat_position: 'bottom-right',
          chat_color: '#008060',
          auto_open_chat: false,
          show_agent_avatar: true,
          enable_product_recommendations: true,
          enable_order_tracking: true,
          enable_analytics: true,
          created_at: new Date(),
          updated_at: new Date()
        })
        .select()
        .single();
      
      if (createSettingsError) {
        console.error('Error creando configuraciones:', createSettingsError);
        return;
      }
      
      console.log('Configuraciones creadas:', newSettings);
    } else if (settingsError) {
      console.error('Error consultando configuraciones:', settingsError);
    } else {
      console.log('Configuraciones ya existen:', settings);
    }
    
    console.log('✅ Widget activado exitosamente para', shopDomain);
    
    // Verificar configuración del widget
    const widgetConfig = await fetch(`https://naay-agent-app1763504937.azurewebsites.net/api/widget/config?shop=${shopDomain}`);
    const configData = await widgetConfig.json();
    
    console.log('📡 Configuración actual del widget:', configData);
    
  } catch (error) {
    console.error('❌ Error activando widget:', error);
  }
}

activateWidget();