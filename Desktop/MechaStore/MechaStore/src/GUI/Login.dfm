object LoginForm: TLoginForm
  Left = 0
  Top = 0
  Caption = 'LoginForm'
  ClientHeight = 673
  ClientWidth = 955
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  TextHeight = 15
  object Label1: TLabel
    Left = 410
    Top = 184
    Width = 135
    Height = 37
    Caption = 'Login Form'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -27
    Font.Name = 'Segoe UI'
    Font.Style = []
    ParentFont = False
  end
  object edtUser: TEdit
    Left = 394
    Top = 256
    Width = 191
    Height = 23
    TabOrder = 0
    Text = 'Username'
  end
  object edtPass: TEdit
    Left = 394
    Top = 312
    Width = 191
    Height = 23
    MaxLength = 8
    PasswordChar = '*'
    TabOrder = 1
    Text = 'Password'
  end
  object btnLogin: TButton
    Left = 454
    Top = 360
    Width = 75
    Height = 25
    Caption = 'Login'
    TabOrder = 2
    OnClick = btnLoginClick
  end
end
