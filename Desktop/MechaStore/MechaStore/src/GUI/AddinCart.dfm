object AddToCartForm: TAddToCartForm
  Left = 0
  Top = 0
  Caption = 'AddToCartForm'
  ClientHeight = 714
  ClientWidth = 1104
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  OnShow = FormShow
  TextHeight = 15
  object Components: TComboBox
    Left = 384
    Top = 143
    Width = 321
    Height = 23
    TabOrder = 0
    Text = 'Components'
  end
  object Quantity: TEdit
    Left = 384
    Top = 328
    Width = 321
    Height = 23
    TabOrder = 1
    Text = 'Quantity'
  end
  object Preview: TMemo
    Left = 384
    Top = 200
    Width = 321
    Height = 89
    Lines.Strings = (
      'Preview')
    TabOrder = 2
  end
  object Add: TButton
    Left = 512
    Top = 408
    Width = 75
    Height = 25
    Caption = 'Add'
    TabOrder = 3
    OnClick = AddClick
  end
end
