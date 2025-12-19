object Register: TRegister
  Left = 0
  Top = 0
  Caption = 'Register'
  ClientHeight = 709
  ClientWidth = 1152
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  TextHeight = 15
  object Label1: TLabel
    Left = 448
    Top = 104
    Width = 213
    Height = 37
    Caption = 'Be a Member First'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -27
    Font.Name = 'Segoe UI'
    Font.Style = []
    ParentFont = False
  end
  object btnRegister: TButton
    Left = 520
    Top = 360
    Width = 75
    Height = 25
    Caption = 'Register'
    TabOrder = 0
    OnClick = btnRegisterClick
  end
  object edtUsername: TEdit
    Left = 448
    Top = 176
    Width = 213
    Height = 23
    TabOrder = 1
    Text = 'Username'
  end
  object edtPassword: TEdit
    Left = 448
    Top = 232
    Width = 213
    Height = 23
    TabOrder = 2
    Text = 'Password'
  end
  object edtWhatsapp: TEdit
    Left = 448
    Top = 288
    Width = 213
    Height = 23
    TabOrder = 3
    Text = 'Whatsapp No.'
  end
end
