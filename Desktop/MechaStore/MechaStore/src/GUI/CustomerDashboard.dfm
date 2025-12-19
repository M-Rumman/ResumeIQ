object UserDashboard: TUserDashboard
  Left = 0
  Top = 0
  Caption = 'UserDashboard'
  ClientHeight = 660
  ClientWidth = 1105
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  TextHeight = 15
  object browseComponents: TButton
    Left = 472
    Top = 129
    Width = 161
    Height = 49
    Caption = 'browseComponents'
    TabOrder = 0
    OnClick = browseComponentsClick
  end
  object AddComponent: TButton
    Left = 472
    Top = 192
    Width = 161
    Height = 49
    Caption = 'AddComponent'
    TabOrder = 1
    OnClick = AddComponentClick
  end
  object AddtoCart: TButton
    Left = 472
    Top = 256
    Width = 161
    Height = 49
    Caption = 'AddtoCart'
    TabOrder = 2
    OnClick = AddtoCartClick
  end
  object ViewCart: TButton
    Left = 472
    Top = 320
    Width = 161
    Height = 49
    Caption = 'ViewCart'
    TabOrder = 3
    OnClick = ViewCartClick
  end
  object CheckOut: TButton
    Left = 472
    Top = 384
    Width = 161
    Height = 49
    Caption = 'CheckOut'
    TabOrder = 4
    OnClick = CheckOutClick
  end
  object LogOut: TButton
    Left = 472
    Top = 448
    Width = 161
    Height = 49
    Caption = 'LogOut'
    TabOrder = 5
    OnClick = LogOutClick
  end
end
