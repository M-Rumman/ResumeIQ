object LoginForm: TLoginForm
  Left = 0
  Top = 0
  Caption = 'LoginForm'
  ClientHeight = 725
  ClientWidth = 1104
  Color = clCream
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clDarkred
  Font.Height = -13
  Font.Name = 'Segoe UI'
  Font.Style = []
  WindowState = wsMaximized
  TextHeight = 17
  object Label1: TLabel
    Left = 488
    Top = 232
    Width = 135
    Height = 37
    AutoSize = False
    Caption = 'Login Form'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clDarkseagreen
    Font.Height = -27
    Font.Name = 'Segoe UI'
    Font.Style = []
    ParentFont = False
  end
  object edtUser: TEdit
    Left = 464
    Top = 304
    Width = 191
    Height = 25
    TabOrder = 0
    Text = 'Username'
  end
  object edtPass: TEdit
    Left = 464
    Top = 360
    Width = 191
    Height = 25
    MaxLength = 8
    PasswordChar = '*'
    TabOrder = 1
    Text = 'Password'
  end
  object btnLogin: TButton
    Left = 524
    Top = 408
    Width = 75
    Height = 25
    Caption = 'Login'
    TabOrder = 2
    OnClick = btnLoginClick
  end
end
