object UserDashboard: TUserDashboard
  Left = 0
  Top = 0
  Caption = 'UserDashboard'
  ClientHeight = 714
  ClientWidth = 1106
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  TextHeight = 15
  object browseComponents: TButton
    Left = 440
    Top = 89
    Width = 161
    Height = 49
    Caption = 'browseComponents'
    TabOrder = 0
    OnClick = browseComponentsClick
  end
  object AddComponent: TButton
    Left = 440
    Top = 152
    Width = 161
    Height = 49
    Caption = 'AddComponent'
    TabOrder = 1
    OnClick = AddComponentClick
  end
  object AddtoCart: TButton
    Left = 440
    Top = 216
    Width = 161
    Height = 49
    Caption = 'AddtoCart'
    TabOrder = 2
    OnClick = AddtoCartClick
  end
  object ViewCart: TButton
    Left = 440
    Top = 280
    Width = 161
    Height = 49
    Caption = 'ViewCart'
    TabOrder = 3
    OnClick = ViewCartClick
  end
  object CheckOut: TButton
    Left = 440
    Top = 344
    Width = 161
    Height = 49
    Caption = 'CheckOut'
    TabOrder = 4
    OnClick = CheckOutClick
  end
  object LogOut: TButton
    Left = 440
    Top = 408
    Width = 161
    Height = 49
    Caption = 'LogOut'
    TabOrder = 5
    OnClick = LogOutClick
  end
end
